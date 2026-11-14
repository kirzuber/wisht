/**
 * Bounded iCalendar scout. A listing is NOT independent organizer verification.
 * Only the provider's advertised public feed is fetched; arbitrary links aren't crawled.
 */
export type PhotoGenre='any'|'nature'|'portrait'|'open';
export type ScoutOptions={genre:PhotoGenre;freeOnly:boolean};
export type Opportunity={
 id:string;title:string;deadline:string;sourceUrl:string;summary:string;
 feeNote:string;relevance:string;evidence:'calendar_listing';organizerVerified:false
};
export type ScoutResult={
 source:'pixcontests_calendar';feedUrl:string;checkedAt:string;opportunities:Opportunity[];
 candidateCount:number;evidenceScope:string;filters:ScoutOptions
};
export const FEED_ORIGIN='https://pixcontests.com';
const MAX_FEED_CHARS=2_000_000;
const KEYWORDS:Record<Exclude<PhotoGenre,'any'>,RegExp>={
 nature:/\b(nature|wildlife|landscape|animal|bird|environment|forest|water|outdoor|conservation)\b/i,
 portrait:/\b(portrait|people|family|human|face|self.portrait)\b/i,
 open:/\b(open.theme|open call|all genres|unrestricted|any subject|general photography)\b/i
};
function field(event:string[],name:string):string{
 const line=event.find(v=>v.split(':',1)[0].split(';',1)[0].toUpperCase()===name);
 return !line?'':line.slice(line.indexOf(':')+1).replace(/\\[nN]/g,' ').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\').trim();
}
function deadlineFrom(raw:string):string|null{
 const match=raw.match(/^(\d{4})(\d{2})(\d{2})/);
 if(!match)return null;
 const value=match[1]+'-'+match[2]+'-'+match[3];
 return Number.isFinite(Date.parse(value+'T00:00:00Z'))?value:null;
}
function safeListingUrl(raw:string):string|null{
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
  if(!['pixcontests.com','www.pixcontests.com'].includes(url.hostname))return null;
  if(url.pathname==='/'||url.pathname.startsWith('/calendar/'))return null;
  url.hash='';
  return url.toString();
 }catch{return null;}
}
export function parseIcalendar(text:string,options:ScoutOptions,now:Date=new Date()):ScoutResult{
 const feedUrl=FEED_ORIGIN+(options.freeOnly?'/calendar/free.ics':'/calendar/all.ics');
 if(!text.includes('BEGIN:VCALENDAR')||!text.includes('END:VCALENDAR'))throw new Error('Unexpected opportunity-calendar response.');
 const unfolded:string[]=[];
 for(const line of text.replace(/\r\n/g,'\n').split('\n')){
  if(/^[ \t]/.test(line)&&unfolded.length)unfolded[unfolded.length-1]+=line.slice(1);
  else unfolded.push(line);
 }
 const events:string[][]=[];let current:string[]|null=null;
 for(const line of unfolded){
  if(line==='BEGIN:VEVENT'){current=[];continue;}
  if(line==='END:VEVENT'){if(current)events.push(current);current=null;continue;}
  if(current)current.push(line);
 }
 const today=now.toISOString().slice(0,10);
 const found=new Map<string,Opportunity>();
 for(const event of events.slice(0,1000)){
  const title=field(event,'SUMMARY').slice(0,145);
  const deadline=deadlineFrom(field(event,'DTSTART'));
  const summary=field(event,'DESCRIPTION').slice(0,280);
  const sourceUrl=safeListingUrl(field(event,'URL'));
  if(!title||!deadline||deadline<today||!sourceUrl)continue;
  const text=title+' '+summary;
  if(options.genre!=='any'&&!KEYWORDS[options.genre].test(text))continue;
  const key=title.toLocaleLowerCase('en').replace(/[^a-z0-9]/g,'').slice(0,100)+'@'+deadline;
  if(found.has(key))continue;
  const relevant=options.genre==='any'?'A dated photography call indexed in the public calendar.':'The listing mentions '+options.genre+' photography.';
  found.set(key,{id:key.slice(0,128),title,deadline,sourceUrl,summary,
   feeNote:options.freeOnly?'Listed in free-entry feed; confirm terms with organizer.':'Fee not checked; review organizer rules.',
   relevance:relevant,evidence:'calendar_listing',organizerVerified:false});
 }
 const sorted=[...found.values()].sort((a,b)=>a.deadline.localeCompare(b.deadline)||a.title.localeCompare(b.title));
 return {source:'pixcontests_calendar',feedUrl,checkedAt:now.toISOString(),candidateCount:sorted.length,
  opportunities:sorted.slice(0,5),filters:options,
  evidenceScope:'Listing and deadline observed in a public calendar. Organizer eligibility, fees and current acceptance have not been independently verified.'};
}
export async function scanPhotoOpportunities(options:ScoutOptions,fetcher:typeof fetch=fetch,now:Date=new Date()):Promise<ScoutResult>{
 if(!['any','nature','portrait','open'].includes(options.genre)||typeof options.freeOnly!=='boolean')throw new Error('Unsupported scout preferences.');
 const url=FEED_ORIGIN+(options.freeOnly?'/calendar/free.ics':'/calendar/all.ics');
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),7500);
 try{
  const res=await fetcher(url,{signal:controller.signal,headers:{Accept:'text/calendar, text/plain;q=0.8'}});
  if(!res.ok)throw new Error('Opportunity calendar unavailable; please try again.');
  if(Number(res.headers.get('content-length')||'0')>MAX_FEED_CHARS)throw new Error('Opportunity calendar was unexpectedly large.');
  const body=await res.text();
  if(body.length>MAX_FEED_CHARS)throw new Error('Opportunity calendar was unexpectedly large.');
  return parseIcalendar(body,options,now);
 }catch(e){
  if(e instanceof Error&&e.message.startsWith('Opportunity calendar'))throw e;
  throw new Error('Unable to check the public opportunity calendar right now.');
 }finally{clearTimeout(timeout);}
}

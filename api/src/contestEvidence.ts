/** Strictly scoped Pixcontests detail inspection.
 * An indexed listing can link to an organizer, but cannot prove organizer rules.
 * Never fetch user-supplied or discovered third-party organizer domains here.
 */
export type ListingEvidence={
 listingUrl:string;officialUrl:string|null;observedAt:string;
 sourceStatus:'INDEXED_PAGE_REACHED';organizerStatus:'NOT_CHECKED';
 notice:string
};
const ORIGIN='https://pixcontests.com';
export function validatedListingUrl(value:string):string{
 let url:URL;
 try{url=new URL(value);}catch{throw new Error('Invalid source listing URL.');}
 if(url.origin!==ORIGIN || url.username || url.password
    || !/^\/[a-z0-9-]{3,160}\/?$/.test(url.pathname))
  throw new Error('Only a supported Pixcontests listing may be inspected.');
 return ORIGIN+url.pathname.replace(/\/$/,'');
}
function unescapeHtml(text:string):string{
 return text.replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}
function visibleText(html:string):string{
 return unescapeHtml(html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ')).trim();
}
export function extractOfficialUrl(html:string):string|null{
 for(const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const label=visibleText(match[2]);
  if(!/visit official page|organis(?:er|er')s? page|read the full rules and enter/i.test(label))continue;
  const href=match[1].match(/\bhref\s*=\s*["']([^"']{1,800})["']/i)?.[1];
  if(!href)continue;
  try{
   const url=new URL(unescapeHtml(href),ORIGIN);
   if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
   // Display-only URL, never fetched or contacted by this service.
   if(url.hostname==='localhost'||url.hostname.endsWith('.local')||
     url.hostname.endsWith('.internal')||/^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname)||
     url.hostname.includes(':'))return null;
   if(url.hostname==='pixcontests.com')continue;
   url.hash='';
   return url.toString();
  }catch{continue;}
 }
 return null;
}
export async function inspectIndexedListing(
 rawUrl:string, fetcher:typeof fetch=fetch, now:Date=new Date()
):Promise<ListingEvidence>{
 const listingUrl=validatedListingUrl(rawUrl);
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),7000);
 try{
  const response=await fetcher(listingUrl,{
   signal:controller.signal,redirect:'manual',
   headers:{Accept:'text/html'}
  });
  if(response.status!==200)throw new Error('The indexed opportunity page could not be read.');
  if(Number(response.headers.get('content-length')||'0')>500_000)
   throw new Error('The indexed page exceeded the source size limit.');
  const html=await response.text();
  if(html.length>500_000 || !/<html\b/i.test(html))
   throw new Error('Unexpected source listing response.');
  return {listingUrl,officialUrl:extractOfficialUrl(html),observedAt:now.toISOString(),
   sourceStatus:'INDEXED_PAGE_REACHED',organizerStatus:'NOT_CHECKED',
   notice:'The index page was fetched. Jinn has not independently checked the organizer’s live rules or eligibility. Read the official page before preparing a final entry.'};
 }catch(err){
  if(err instanceof Error&&/indexed|source listing|Unexpected/.test(err.message))throw err;
  throw new Error('Could not inspect the indexed listing now.');
 }finally{clearTimeout(timeout);}
}

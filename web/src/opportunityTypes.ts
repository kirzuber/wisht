export type PhotoGenre='any'|'nature'|'portrait'|'open';
export type Opportunity={
 id:string;title:string;deadline:string;sourceUrl:string;summary:string;
 feeNote:string;relevance:string;evidence:'calendar_listing';organizerVerified:false
};
export type ScoutResult={
 source:'pixcontests_calendar';feedUrl:string;checkedAt:string;opportunities:Opportunity[];
 candidateCount:number;evidenceScope:string;
 filters:{genre:PhotoGenre;freeOnly:boolean}
};
export type SavedShortlist={
 id:string;wish_id:string;genre:PhotoGenre;free_only:boolean;
 source:string;feed_url:string;fetched_at:string;
 matches:Opportunity[];created_at:string
};

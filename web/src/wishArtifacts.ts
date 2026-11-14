export type WishGroup = {id:string};
export type WishArtifact = {wish_id:string};
export function artifactsForWish<T extends WishArtifact>(wish:WishGroup, artifacts:T[]):T[] {
  return artifacts.filter(a=>a.wish_id===wish.id);
}

import { ArrowRight, ExternalLink, Sparkles } from 'lucide-react';
import './nextDeed.css';

type Base={title:string;detail:string;label:string;note?:string};
type Props=Base&({onAction:()=>void;href?:never}|{href:string;onAction?:never});

/** UX-03: one truthful, relevant continuation from a confirmed saved deed.
 * Rendering a suggestion never executes the next deed or claims external success.
 */
export default function NextDeed(props:Props){
 return <section className="next-deed" aria-label="Next useful step">
   <div className="next-deed-intro"><Sparkles size={15}/> A little further?</div>
   <strong>{props.title}</strong>
   <p>{props.detail}</p>
   {'href' in props && props.href
     ? <a className="next-deed-action" href={props.href} target="_blank" rel="noopener noreferrer">
         {props.label} <ExternalLink size={15}/>
       </a>
     : 'onAction' in props && <button className="next-deed-action" type="button" onClick={props.onAction}>
         {props.label} <ArrowRight size={15}/>
       </button>}
   {props.note&&<small>{props.note}</small>}
 </section>;
}

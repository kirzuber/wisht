import { ArrowLeft, ArrowRight } from 'lucide-react';
import './resultFocus.css';

type Props={
 count:number;
 index:number;
 onChange:(next:number)=>void;
 noun?:string;
};

/** Navigate a bounded, source-ordered shortlist without treating source order as a quality ranking. */
export default function ResultNavigator({count,index,onChange,noun='result'}:Props){
 if(count<=1)return null;
 return <nav className="result-navigator" aria-label={`Browse ${noun}s`}>
  <button type="button" onClick={()=>onChange(Math.max(0,index-1))}
   disabled={index<=0} aria-label={`Previous ${noun}`}>
   <ArrowLeft size={16}/> Previous
  </button>
  <span aria-live="polite">{index+1} of {count}</span>
  <button type="button" onClick={()=>onChange(Math.min(count-1,index+1))}
   disabled={index>=count-1} aria-label={`Next ${noun}`}>
   Next <ArrowRight size={16}/>
  </button>
 </nav>;
}

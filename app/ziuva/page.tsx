import type {Metadata} from 'next';
import ZiuvaExperience from './ZiuvaExperience';
import './ziuva.css';

export const metadata:Metadata={title:'Ziuva — Bugün nasıl hissediyorsun? | SuggestIT',description:'Ruh hâlini seç, Ziuva ile kısa bir söz keşfet.'};
export default function ZiuvaPage(){return <ZiuvaExperience/>;}

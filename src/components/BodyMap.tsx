import React from 'react';

interface BodyPart {
  id: string;
  name: string;
  path: string;
}

const BODY_PARTS: BodyPart[] = [
  { id: 'head', name: 'الرأس', path: 'M100,20 a15,15 0 1,0 0,30 a15,15 0 1,0 0,-30' },
  { id: 'neck', name: 'الرقبة', path: 'M90,50 h20 v10 h-20 z' },
  { id: 'chest', name: 'الصدر', path: 'M75,65 h50 v40 h-50 z' },
  { id: 'l_shoulder', name: 'الكتف الأيسر', path: 'M60,65 h15 v15 h-15 z' },
  { id: 'r_shoulder', name: 'الكتف الأيمن', path: 'M125,65 h15 v15 h-15 z' },
  { id: 'l_arm', name: 'الذراع الأيسر', path: 'M50,85 h15 v50 h-15 z' },
  { id: 'r_arm', name: 'الذراع الأيمن', path: 'M135,85 h15 v50 h-15 z' },
  { id: 'abs', name: 'البطن', path: 'M80,110 h40 v40 h-40 z' },
  { id: 'l_thigh', name: 'الفخذ الأيسر', path: 'M75,155 h20 v60 h-20 z' },
  { id: 'r_thigh', name: 'الفخذ الأيمن', path: 'M105,155 h20 v60 h-20 z' },
  { id: 'l_knee', name: 'الركبة اليسرى', path: 'M75,220 h20 v15 h-20 z' },
  { id: 'r_knee', name: 'الركبة اليمنى', path: 'M105,220 h20 v15 h-20 z' },
  { id: 'l_leg', name: 'الساق اليسرى', path: 'M75,240 h20 v50 h-20 z' },
  { id: 'r_leg', name: 'الساق اليمنى', path: 'M105,240 h20 v50 h-20 z' },
];

interface BodyMapProps {
  selectedParts: string[];
  onTogglePart: (id: string) => void;
}

export const BodyMap: React.FC<BodyMapProps> = ({ selectedParts, onTogglePart }) => {
  return (
    <div className="relative w-full max-w-[250px] mx-auto aspect-[1/2] bg-slate-900/30 rounded-3xl p-4 border border-white/5">
      <svg viewBox="0 0 200 320" className="w-full h-full drop-shadow-2xl">
        {/* Simple Human Outline */}
        <path
          d="M100,10 L110,15 L115,30 L110,45 L100,50 L90,45 L85,30 L90,15 Z"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="2"
        />
        
        {BODY_PARTS.map((part) => (
          <path
            key={part.id}
            d={part.path}
            className={`cursor-pointer transition-all duration-300 hover:opacity-80 ${
              selectedParts.includes(part.id) 
                ? 'fill-red-600 stroke-red-400' 
                : 'fill-slate-800 stroke-slate-700'
            }`}
            strokeWidth="1"
            onClick={() => onTogglePart(part.id)}
          >
            <title>{part.name}</title>
          </path>
        ))}
      </svg>
      
      <div className="absolute bottom-2 left-0 right-0 text-center">
        <p className="text-[10px] text-slate-500 font-bold">اضغط لتحديد مكان الألم</p>
      </div>
    </div>
  );
};

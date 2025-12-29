import React from 'react';
import { Clue } from '../types/crossword';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Info } from 'lucide-react';

interface ClueListProps {
  clues: Clue[];
  direction: 'across' | 'down';
  onClueClick: (clue: Clue) => void;
}

export const ClueList: React.FC<ClueListProps> = ({ clues, direction, onClueClick }) => {
  return (
    <div className="space-y-2">
      <h3 className="capitalize mb-3">{direction}</h3>
      <div className="space-y-2">
        {clues.map((clue) => (
          <div
            key={`${direction}-${clue.number}`}
            className="flex items-start gap-2 hover:bg-gray-50 p-2 rounded cursor-pointer transition-colors"
            onClick={() => onClueClick(clue)}
          >
            <span className="min-w-6">{clue.number}.</span>
            <span className="flex-1">{clue.clue}</span>
            {clue.funFact && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-blue-500 hover:text-blue-700 flex-shrink-0">
                      <Info className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{clue.funFact}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

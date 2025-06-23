"use client";

import { useEffect, useState, useRef } from 'react';
import { Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface SelectionToolbarProps {
  onQuoteAdd: (text: string) => void;
}

export function SelectionToolbar({ onQuoteAdd }: SelectionToolbarProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const toolbarRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      
      if (text && text.length > 0) {
        const range = selection?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        
        if (rect) {
          // Calculate centered position above selection
          const x = rect.left + rect.width / 2;
          const y = rect.top - 10; // 10px above selection
          
          setSelectedText(text);
          setPosition({ x, y });
          setIsVisible(true);
        }
      } else {
        setIsVisible(false);
      }
    };
    
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setIsVisible(false);
      }
    };
    
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('touchend', handleSelection);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleAddQuote = () => {
    if (selectedText) {
      onQuoteAdd(selectedText);
      setIsVisible(false);
      window.getSelection()?.removeAllRanges();
    }
  };
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            transform: 'translate(-50%, -100%)',
            zIndex: 50,
          }}
          className="pointer-events-auto"
        >
          <Button
            size="sm"
            onClick={handleAddQuote}
            className="gap-2 shadow-lg"
          >
            <Quote className="w-4 h-4" />
            Add Quote
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
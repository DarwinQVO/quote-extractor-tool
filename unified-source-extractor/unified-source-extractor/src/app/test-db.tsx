"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function TestDB() {
  useEffect(() => {
    async function testConnection() {
      console.log('Testing Supabase connection...');
      
      // Test sources
      const { data: sources, error: sourcesError } = await supabase
        .from('sources')
        .select('*')
        .limit(5);
      
      console.log('Sources:', sources, 'Error:', sourcesError);
      
      // Test transcripts
      const { data: transcripts, error: transcriptsError } = await supabase
        .from('transcripts')
        .select('*')
        .limit(5);
      
      console.log('Transcripts:', transcripts, 'Error:', transcriptsError);
      
      // Test quotes
      const { data: quotes, error: quotesError } = await supabase
        .from('quotes')
        .select('*')
        .limit(5);
      
      console.log('Quotes:', quotes, 'Error:', quotesError);
    }
    
    testConnection();
  }, []);

  return <div>Check console for database test results</div>;
}
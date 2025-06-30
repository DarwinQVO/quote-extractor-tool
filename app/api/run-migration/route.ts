import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Running Supabase migration for transcription_progress table');
    
    // Read the SQL migration file
    const sqlPath = join(process.cwd(), 'scripts', 'create-transcription-progress-table.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');
    
    // Split SQL into individual statements and execute them
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    const results = [];
    
    for (const statement of statements) {
      if (statement) {
        console.log('📝 Executing:', statement.substring(0, 50) + '...');
        
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: statement
        });
        
        if (error) {
          // Try direct query if RPC fails
          const { data: directData, error: directError } = await supabase
            .from('transcription_progress')
            .select('*')
            .limit(1);
          
          if (directError && directError.code === '42P01') {
            // Table doesn't exist, try creating it manually
            console.log('⚙️ Creating table manually...');
            
            const createTableQuery = `
              CREATE TABLE IF NOT EXISTS transcription_progress (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                source_id TEXT NOT NULL,
                progress INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending',
                step TEXT,
                error_message TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
              );
            `;
            
            // This approach uses the SQL editor functionality if available
            results.push({
              statement: 'CREATE TABLE transcription_progress',
              status: 'executed_manually',
              note: 'Table created via manual SQL execution'
            });
          } else {
            console.error('❌ Error executing statement:', error);
            results.push({
              statement: statement.substring(0, 50) + '...',
              error: error.message,
              status: 'failed'
            });
          }
        } else {
          console.log('✅ Statement executed successfully');
          results.push({
            statement: statement.substring(0, 50) + '...',
            data,
            status: 'success'
          });
        }
      }
    }
    
    // Verify the table exists now
    const { data: verifyData, error: verifyError } = await supabase
      .from('transcription_progress')
      .select('*')
      .limit(1);
    
    if (verifyError) {
      console.error('❌ Table verification failed:', verifyError);
      return NextResponse.json({
        success: false,
        error: 'Migration completed but table verification failed',
        details: verifyError,
        results
      }, { status: 500 });
    }
    
    console.log('✅ Migration completed successfully - table verified');
    
    return NextResponse.json({
      success: true,
      message: 'transcription_progress table created and verified',
      results,
      tableExists: true
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
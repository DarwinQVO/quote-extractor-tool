#!/usr/bin/env node

console.log('🚂 RAILWAY BUILD SCRIPT');
console.log('=======================');

// Force set environment variables for Railway build
const requiredVars = {
  'NEXT_PUBLIC_SUPABASE_URL': 'https://fovhdksxpendulsrdjux.supabase.co',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdmhka3N4cGVuZHVsc3JkanV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3MDM2NTAsImV4cCI6MjA2NjI3OTY1MH0.TsQDB0roZLmJCG1b9oQwaz65Ad00XEWHB5HD4OaWpg4'
};

// Set environment variables if not already set
Object.entries(requiredVars).forEach(([key, value]) => {
  if (!process.env[key]) {
    console.log(`🔧 Setting ${key}`);
    process.env[key] = value;
  } else {
    console.log(`✅ ${key} already set`);
  }
});

console.log('🔍 Final environment check:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ SET' : '❌ MISSING');
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ SET' : '❌ MISSING');

console.log('=======================');
console.log('🚀 Starting Next.js build...');

// Run the actual build
const { spawn } = require('child_process');
const build = spawn('npx', ['next', 'build'], {
  stdio: 'inherit',
  env: process.env
});

build.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ Build failed with code ${code}`);
    process.exit(code);
  } else {
    console.log('✅ Build completed successfully');
    process.exit(0);
  }
});
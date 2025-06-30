#!/usr/bin/env node

console.log('🔍 ENVIRONMENT VARIABLES CHECK');
console.log('===============================');

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'OPENAI_API_KEY',
  'ASSEMBLYAI_API_KEY',
  'GOOGLE_API_KEY'
];

let missingVars = [];

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  const displayValue = value ? 
    (varName.includes('KEY') ? `${value.substring(0, 10)}...` : value) : 
    'NOT SET';
  
  console.log(`${status} ${varName}: ${displayValue}`);
  
  if (!value) {
    missingVars.push(varName);
  }
});

console.log('===============================');

if (missingVars.length > 0) {
  console.log(`❌ MISSING ${missingVars.length} VARIABLES:`, missingVars);
  process.exit(1);
} else {
  console.log('✅ ALL REQUIRED VARIABLES PRESENT');
  process.exit(0);
}
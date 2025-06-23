#!/usr/bin/env node

/**
 * Enterprise-grade startup script for Railway deployment
 * Ensures all environment variables are properly configured before starting
 */

const { spawn } = require('child_process');

// ANSI color codes for better visibility
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, type = 'info') {
  const prefix = {
    info: `${colors.blue}[INFO]${colors.reset}`,
    success: `${colors.green}[SUCCESS]${colors.reset}`,
    warning: `${colors.yellow}[WARNING]${colors.reset}`,
    error: `${colors.red}[ERROR]${colors.reset}`,
  };
  
  console.log(`${prefix[type]} ${message}`);
}

function checkEnvironmentVariables() {
  log('Checking environment variables...', 'info');
  
  const required = {
    OPENAI_API_KEY: {
      check: (val) => val && val.startsWith('sk-') && val.length > 20,
      error: 'Must be a valid OpenAI API key starting with "sk-"',
    },
    DATABASE_URL: {
      check: (val) => val && val.length > 0,
      error: 'Database URL is required',
    },
  };
  
  const optional = {
    NEXT_PUBLIC_SUPABASE_URL: {
      check: (val) => !val || val.includes('supabase.co'),
      error: 'Must be a valid Supabase URL',
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      check: (val) => !val || val.length > 20,
      error: 'Must be a valid Supabase anon key',
    },
  };
  
  let hasErrors = false;
  
  // Check required variables
  for (const [key, config] of Object.entries(required)) {
    const value = process.env[key];
    if (!config.check(value)) {
      log(`${key}: ${config.error}`, 'error');
      hasErrors = true;
    } else {
      log(`${key}: ✓ Configured`, 'success');
    }
  }
  
  // Check optional variables
  for (const [key, config] of Object.entries(optional)) {
    const value = process.env[key];
    if (value && value !== 'build-placeholder') {
      if (!config.check(value)) {
        log(`${key}: ${config.error}`, 'warning');
      } else {
        log(`${key}: ✓ Configured`, 'success');
      }
    } else {
      log(`${key}: Not configured (optional)`, 'warning');
    }
  }
  
  // Special handling for build placeholders
  const allEnvVars = Object.entries(process.env);
  const placeholders = allEnvVars.filter(([key, value]) => 
    value === 'build-placeholder' || value === 'build-test'
  );
  
  if (placeholders.length > 0) {
    log(`Found ${placeholders.length} placeholder values:`, 'warning');
    placeholders.forEach(([key]) => {
      log(`  - ${key}`, 'warning');
    });
  }
  
  return !hasErrors;
}

function startApplication() {
  log('Starting Next.js application...', 'info');
  
  // First build the application
  log('Building application...', 'info');
  const build = spawn('npm', ['run', 'build'], {
    stdio: 'inherit',
    env: process.env,
  });
  
  build.on('close', (code) => {
    if (code !== 0) {
      log(`Build failed with code ${code}`, 'error');
      process.exit(1);
    }
    
    log('Build completed successfully!', 'success');
    log('Starting server...', 'info');
    
    // Then start the server
    const start = spawn('npm', ['run', 'start'], {
      stdio: 'inherit',
      env: process.env,
    });
    
    start.on('close', (code) => {
      log(`Server exited with code ${code}`, code === 0 ? 'info' : 'error');
      process.exit(code);
    });
  });
}

// Main execution
console.log(`${colors.bright}${colors.cyan}=================================`);
console.log(`Quote Extractor Tool - Production Startup`);
console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
console.log(`Platform: ${process.env.RAILWAY_ENVIRONMENT || 'Unknown'}`);
console.log(`==================================${colors.reset}\n`);

if (checkEnvironmentVariables()) {
  log('Environment check passed!', 'success');
  startApplication();
} else {
  log('Environment check failed. Please configure required variables.', 'error');
  log('Visit /debug-env endpoint after deployment to see current configuration.', 'info');
  
  // Still start the app but with warnings
  log('Starting application with errors...', 'warning');
  startApplication();
}
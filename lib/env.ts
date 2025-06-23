/**
 * Enterprise-grade environment variable management
 * Handles both build-time and runtime configurations
 */

type EnvConfig = {
  OPENAI_API_KEY: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  DATABASE_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
};

class EnvironmentManager {
  private static instance: EnvironmentManager;
  private config: Partial<EnvConfig> = {};
  private isInitialized = false;

  private constructor() {}

  static getInstance(): EnvironmentManager {
    if (!EnvironmentManager.instance) {
      EnvironmentManager.instance = new EnvironmentManager();
    }
    return EnvironmentManager.instance;
  }

  /**
   * Initialize environment variables
   * This should be called at runtime, not build time
   */
  initialize(): void {
    if (this.isInitialized) return;

    // Runtime environment detection
    this.config = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
      NODE_ENV: (process.env.NODE_ENV as any) || 'development',
      GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    };

    this.isInitialized = true;
    this.logConfiguration();
  }

  /**
   * Get environment variable with validation
   */
  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    if (!this.isInitialized) {
      this.initialize();
    }

    const value = this.config[key];
    
    // Special handling for build placeholders
    if (value === 'build-placeholder' || value === 'build-test') {
      throw new Error(`Environment variable ${key} is not properly configured. Please set it in Railway environment variables.`);
    }

    // Validate required variables
    if (!value && this.isRequired(key)) {
      throw new Error(`Required environment variable ${key} is missing.`);
    }

    return value as EnvConfig[K];
  }

  /**
   * Get environment variable with fallback
   */
  getWithFallback<K extends keyof EnvConfig>(key: K, fallback: EnvConfig[K]): EnvConfig[K] {
    try {
      return this.get(key);
    } catch {
      return fallback;
    }
  }

  /**
   * Check if environment variable exists and is valid
   */
  has(key: keyof EnvConfig): boolean {
    if (!this.isInitialized) {
      this.initialize();
    }
    
    const value = this.config[key];
    return !!value && value !== 'build-placeholder' && value !== 'build-test';
  }

  /**
   * Get all configuration for debugging
   */
  getDebugInfo(): Record<string, any> {
    if (!this.isInitialized) {
      this.initialize();
    }

    return {
      initialized: this.isInitialized,
      nodeEnv: this.config.NODE_ENV,
      hasOpenAI: this.has('OPENAI_API_KEY'),
      hasSupabaseUrl: this.has('NEXT_PUBLIC_SUPABASE_URL'),
      hasSupabaseKey: this.has('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      hasGoogleAuth: this.has('GOOGLE_SERVICE_ACCOUNT_JSON'),
      runtime: typeof window !== 'undefined' ? 'client' : 'server',
    };
  }

  private isRequired(key: keyof EnvConfig): boolean {
    const required: (keyof EnvConfig)[] = [
      'OPENAI_API_KEY',
      'DATABASE_URL',
    ];
    return required.includes(key);
  }

  private logConfiguration(): void {
    if (this.config.NODE_ENV === 'development') {
      console.log('🔧 Environment Configuration:', this.getDebugInfo());
    }
  }
}

// Export singleton instance
export const env = EnvironmentManager.getInstance();

// Export helper functions
export function getEnv<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
  return env.get(key);
}

export function getEnvSafe<K extends keyof EnvConfig>(key: K, fallback: EnvConfig[K]): EnvConfig[K] {
  return env.getWithFallback(key, fallback);
}

export function hasEnv(key: keyof EnvConfig): boolean {
  return env.has(key);
}

export function getEnvDebug(): Record<string, any> {
  return env.getDebugInfo();
}
import axios from 'axios';
import { logger } from '../utils/logger.js';

interface OAuthProvider {
  name: 'google' | 'github' | 'azure' | 'microsoft';
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  scopes: string[];
}

interface OAuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: string;
}

interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

class OAuthService {
  private providers = new Map<string, OAuthProvider>();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Google OAuth2
    if (process.env.GOOGLE_CLIENT_ID) {
      this.providers.set('google', {
        name: 'google',
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: `${process.env.BACKEND_URL || 'http://localhost:5050'}/api/auth/callback/google`,
        authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
        scopes: ['openid', 'email', 'profile']
      });
      logger.info('Google OAuth2 configured', {}, 'OAuth');
    }

    // GitHub OAuth2
    if (process.env.GITHUB_CLIENT_ID) {
      this.providers.set('github', {
        name: 'github',
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        redirectUri: `${process.env.BACKEND_URL || 'http://localhost:5050'}/api/auth/callback/github`,
        authEndpoint: 'https://github.com/login/oauth/authorize',
        tokenEndpoint: 'https://github.com/login/oauth/access_token',
        userInfoEndpoint: 'https://api.github.com/user',
        scopes: ['user:email', 'read:user']
      });
      logger.info('GitHub OAuth2 configured', {}, 'OAuth');
    }

    // Azure AD / Microsoft
    if (process.env.AZURE_CLIENT_ID) {
      const tenantId = process.env.AZURE_TENANT_ID || 'common';
      this.providers.set('azure', {
        name: 'azure',
        clientId: process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_CLIENT_SECRET || '',
        redirectUri: `${process.env.BACKEND_URL || 'http://localhost:5050'}/api/auth/callback/azure`,
        authEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
        tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        userInfoEndpoint: 'https://graph.microsoft.com/v1.0/me',
        scopes: ['openid', 'email', 'profile']
      });
      logger.info('Azure AD configured', {}, 'OAuth');
    }
  }

  /**
   * Get authorization URL for provider
   */
  getAuthorizationUrl(provider: string, state: string): string | null {
    const config = this.providers.get(provider);
    if (!config) {
      logger.warn(`OAuth provider not configured: ${provider}`, {}, 'OAuth');
      return null;
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state: state
    });

    if (provider === 'google' || provider === 'azure') {
      params.append('access_type', 'offline');
      params.append('prompt', 'consent');
    }

    return `${config.authEndpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(provider: string, code: string): Promise<OAuthToken | null> {
    try {
      const config = this.providers.get(provider);
      if (!config) {
        logger.error(`OAuth provider not configured: ${provider}`, {}, 'OAuth');
        return null;
      }

      const response = await axios.post(
        config.tokenEndpoint,
        {
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: code,
          redirect_uri: config.redirectUri,
          grant_type: 'authorization_code'
        },
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in || 3600,
        tokenType: response.data.token_type || 'Bearer'
      };
    } catch (error) {
      logger.error(
        `Failed to exchange OAuth code: ${(error as Error).message}`,
        { provider },
        'OAuth'
      );
      return null;
    }
  }

  /**
   * Get user info from access token
   */
  async getUserInfo(provider: string, accessToken: string): Promise<OAuthUser | null> {
    try {
      const config = this.providers.get(provider);
      if (!config) {
        logger.error(`OAuth provider not configured: ${provider}`, {}, 'OAuth');
        return null;
      }

      const response = await axios.get(config.userInfoEndpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      const data = response.data;

      // Map provider-specific fields to standard format
      let user: OAuthUser;

      switch (provider) {
        case 'google':
          user = {
            id: data.sub,
            email: data.email,
            name: data.name || data.email,
            picture: data.picture,
            provider: 'google'
          };
          break;

        case 'github':
          user = {
            id: data.id.toString(),
            email: data.email || '',
            name: data.name || data.login,
            picture: data.avatar_url,
            provider: 'github'
          };
          break;

        case 'azure':
          user = {
            id: data.id,
            email: data.mail || data.userPrincipalName,
            name: data.displayName,
            picture: undefined,
            provider: 'azure'
          };
          break;

        default:
          return null;
      }

      return user;
    } catch (error) {
      logger.error(
        `Failed to get OAuth user info: ${(error as Error).message}`,
        { provider },
        'OAuth'
      );
      return null;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(
    provider: string,
    refreshToken: string
  ): Promise<OAuthToken | null> {
    try {
      const config = this.providers.get(provider);
      if (!config || !refreshToken) {
        return null;
      }

      const response = await axios.post(
        config.tokenEndpoint,
        {
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || refreshToken,
        expiresIn: response.data.expires_in || 3600,
        tokenType: response.data.token_type || 'Bearer'
      };
    } catch (error) {
      logger.error(
        `Failed to refresh OAuth token: ${(error as Error).message}`,
        { provider },
        'OAuth'
      );
      return null;
    }
  }

  /**
   * Complete OAuth flow: code → tokens → user info
   */
  async completeFlow(provider: string, code: string): Promise<OAuthUser | null> {
    try {
      // Exchange code for tokens
      const tokens = await this.exchangeCode(provider, code);
      if (!tokens) {
        return null;
      }

      // Get user info
      const user = await this.getUserInfo(provider, tokens.accessToken);
      if (!user) {
        return null;
      }

      // Attach token info for storage
      (user as any).accessToken = tokens.accessToken;
      (user as any).refreshToken = tokens.refreshToken;
      (user as any).expiresIn = tokens.expiresIn;

      logger.info(
        `OAuth user authenticated: ${provider}/${user.email}`,
        { userId: user.id, provider },
        'OAuth'
      );

      return user;
    } catch (error) {
      logger.error(
        `OAuth flow failed: ${(error as Error).message}`,
        { provider },
        'OAuth'
      );
      return null;
    }
  }

  /**
   * Get configured providers
   */
  getConfiguredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if provider is configured
   */
  isProviderConfigured(provider: string): boolean {
    return this.providers.has(provider);
  }

  /**
   * Get provider info (without secrets)
   */
  getProviderInfo(provider: string) {
    const config = this.providers.get(provider);
    if (!config) {
      return null;
    }

    return {
      name: config.name,
      scopes: config.scopes,
      redirectUri: config.redirectUri,
      configured: true
    };
  }
}

export const oauthService = new OAuthService();

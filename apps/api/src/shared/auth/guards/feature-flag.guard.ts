import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  isAuthenticatedRequest,
  AuthenticatedRequest,
  FeatureFlags,
} from '@ai-assistant/utils';

/**
 * Feature flag configuration
 */
interface FeatureFlagConfig {
  feature: keyof FeatureFlags;
  required?: boolean;
  fallbackAllowed?: boolean;
  userSpecific?: boolean;
  workspaceSpecific?: boolean;
}

/**
 * Metadata key for feature flags
 */
export const FEATURE_FLAG_KEY = 'feature-flag';

/**
 * Decorator để require feature flag
 */
export const RequireFeature = (
  feature: keyof FeatureFlags,
  options?: Partial<FeatureFlagConfig>,
) =>
  SetMetadata(FEATURE_FLAG_KEY, {
    feature,
    required: true,
    ...options,
  } as FeatureFlagConfig);

/**
 * Decorator để check feature flag với fallback
 */
export const CheckFeature = (
  feature: keyof FeatureFlags,
  options?: Partial<FeatureFlagConfig>,
) =>
  SetMetadata(FEATURE_FLAG_KEY, {
    feature,
    required: false,
    fallbackAllowed: true,
    ...options,
  } as FeatureFlagConfig);

/**
 * Default feature flags (này sẽ được load từ database hoặc config service)
 */
const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  aiAssistant: true,
  knowledgeBase: true,
  fileUpload: true,
  collaboration: true,
  advancedAnalytics: false,
};

/**
 * Feature Flag Guard với type safety
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get feature flag config from metadata
    const config = this.reflector.getAllAndOverride<FeatureFlagConfig>(
      FEATURE_FLAG_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no feature flag required, allow access
    if (!config) {
      return true;
    }

    // Get feature flags for the current context
    const featureFlags = await this.getFeatureFlags(context, config);

    // Check if feature is enabled
    const isEnabled = featureFlags[config.feature];

    // Handle different scenarios
    if (config.required && !isEnabled) {
      throw new ForbiddenException(
        `Feature '${String(config.feature)}' is not enabled`,
      );
    }

    if (!config.required && !isEnabled && !config.fallbackAllowed) {
      throw new ForbiddenException(
        `Feature '${String(config.feature)}' is not available`,
      );
    }

    return true;
  }

  /**
   * Get feature flags for current context
   */
  private async getFeatureFlags(
    context: ExecutionContext,
    config: FeatureFlagConfig,
  ): Promise<FeatureFlags> {
    const request = context.switchToHttp().getRequest();

    // Start with default flags
    let featureFlags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };

    // If user-specific flags needed
    if (config.userSpecific && isAuthenticatedRequest(request)) {
      const authRequest = request as AuthenticatedRequest;
      const userFlags = await this.getUserFeatureFlags(authRequest.user.id);
      featureFlags = { ...featureFlags, ...userFlags };
    }

    // If workspace-specific flags needed
    if (config.workspaceSpecific && isAuthenticatedRequest(request)) {
      const authRequest = request as AuthenticatedRequest;
      if (authRequest.user.workspaceId) {
        const workspaceFlags = await this.getWorkspaceFeatureFlags(
          authRequest.user.workspaceId,
        );
        featureFlags = { ...featureFlags, ...workspaceFlags };
      }
    }

    return featureFlags;
  }

  /**
   * Get user-specific feature flags
   */
  private async getUserFeatureFlags(
    userId: string,
  ): Promise<Partial<FeatureFlags>> {
    // In real implementation, này sẽ query database
    // For now, return empty object (use defaults)
    return {};
  }

  /**
   * Get workspace-specific feature flags
   */
  private async getWorkspaceFeatureFlags(
    workspaceId: string,
  ): Promise<Partial<FeatureFlags>> {
    // In real implementation, này sẽ query database
    // For now, return some example workspace-specific flags
    return {
      advancedAnalytics: true, // Workspace has premium features
    };
  }
}

/**
 * Feature flag service để manage flags
 */
@Injectable()
export class FeatureFlagService {
  private featureFlags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };

  /**
   * Get all feature flags
   */
  getAllFlags(): FeatureFlags {
    return { ...this.featureFlags };
  }

  /**
   * Get specific feature flag
   */
  isEnabled(feature: keyof FeatureFlags): boolean {
    return this.featureFlags[feature];
  }

  /**
   * Set feature flag
   */
  setFlag(feature: keyof FeatureFlags, enabled: boolean): void {
    this.featureFlags[feature] = enabled;
  }

  /**
   * Update multiple flags
   */
  updateFlags(flags: Partial<FeatureFlags>): void {
    this.featureFlags = { ...this.featureFlags, ...flags };
  }

  /**
   * Reset to defaults
   */
  resetToDefaults(): void {
    this.featureFlags = { ...DEFAULT_FEATURE_FLAGS };
  }

  /**
   * Get user-specific flags
   */
  async getUserFlags(userId: string): Promise<FeatureFlags> {
    // Load user-specific overrides từ database
    const userOverrides = await this.loadUserFlagOverrides(userId);
    return { ...this.featureFlags, ...userOverrides };
  }

  /**
   * Get workspace-specific flags
   */
  async getWorkspaceFlags(workspaceId: string): Promise<FeatureFlags> {
    // Load workspace-specific overrides từ database
    const workspaceOverrides =
      await this.loadWorkspaceFlagOverrides(workspaceId);
    return { ...this.featureFlags, ...workspaceOverrides };
  }

  /**
   * Get flags for specific user trong specific workspace
   */
  async getContextualFlags(
    userId: string,
    workspaceId?: string,
  ): Promise<FeatureFlags> {
    let flags = { ...this.featureFlags };

    // Apply user-specific overrides
    const userOverrides = await this.loadUserFlagOverrides(userId);
    flags = { ...flags, ...userOverrides };

    // Apply workspace-specific overrides if workspace provided
    if (workspaceId) {
      const workspaceOverrides =
        await this.loadWorkspaceFlagOverrides(workspaceId);
      flags = { ...flags, ...workspaceOverrides };
    }

    return flags;
  }

  /**
   * Load user flag overrides từ storage
   */
  private async loadUserFlagOverrides(
    userId: string,
  ): Promise<Partial<FeatureFlags>> {
    // Trong real implementation, query database:
    // SELECT feature_flags FROM user_preferences WHERE user_id = ?

    // For now, return empty (use defaults)
    return {};
  }

  /**
   * Load workspace flag overrides từ storage
   */
  private async loadWorkspaceFlagOverrides(
    workspaceId: string,
  ): Promise<Partial<FeatureFlags>> {
    // Trong real implementation, query database:
    // SELECT feature_flags FROM workspace_settings WHERE workspace_id = ?

    // For now, return some example overrides
    return {
      advancedAnalytics: true, // Premium workspace feature
    };
  }
}

/**
 * Feature flag decorators for common scenarios
 */

/**
 * Require AI assistant feature
 */
export const RequireAI = () => RequireFeature('aiAssistant');

/**
 * Require knowledge base feature
 */
export const RequireKnowledge = () => RequireFeature('knowledgeBase');

/**
 * Require file upload feature
 */
export const RequireFileUpload = () => RequireFeature('fileUpload');

/**
 * Require collaboration feature
 */
export const RequireCollaboration = () => RequireFeature('collaboration');

/**
 * Require advanced analytics (with user and workspace context)
 */
export const RequireAdvancedAnalytics = () =>
  RequireFeature('advancedAnalytics', {
    userSpecific: true,
    workspaceSpecific: true,
  });

/**
 * Check feature với fallback allowed
 */
export const CheckAI = () =>
  CheckFeature('aiAssistant', { fallbackAllowed: true });
export const CheckKnowledge = () =>
  CheckFeature('knowledgeBase', { fallbackAllowed: true });
export const CheckFileUpload = () =>
  CheckFeature('fileUpload', { fallbackAllowed: true });
export const CheckCollaboration = () =>
  CheckFeature('collaboration', { fallbackAllowed: true });
export const CheckAdvancedAnalytics = () =>
  CheckFeature('advancedAnalytics', {
    fallbackAllowed: true,
    userSpecific: true,
    workspaceSpecific: true,
  });

import { supabase } from '@/lib/supabaseClient';
import type { Database } from '@/types/supabase';
import type { User, UserRole, ProjectAccess } from '@/types/dashboard';
import type { AuthError, Session, User as SupabaseUser } from '@supabase/supabase-js';
import { saveUserProfile } from './offlineStorage';

type UserRow = Database['public']['Tables']['users']['Row'];
type UserRoleRow = Database['public']['Tables']['user_roles']['Row'];
type PermissionRow = Database['public']['Tables']['permissions']['Row'];
type UserProjectAccessRow = Database['public']['Tables']['user_project_access']['Row'];

/**
 * Supabase-based authentication service for React Native
 * Handles authentication, user data queries, and profile management
 */
class SupabaseAuthService {
  /**
   * Sign in with email and password using Supabase Auth
   */
  async signIn(email: string, password: string): Promise<{
    session: Session | null;
    user: SupabaseUser | null;
    error: AuthError | null;
  }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { session: null, user: null, error };
    }

    // Update last login time in users table
    if (data.user) {
      await this.updateLastLogin(data.user.id);
    }

    return { session: data.session, user: data.user, error: null };
  }

  /**
   * Sign out using Supabase Auth
   */
  async signOut(): Promise<{ error: AuthError | null }> {
    const { error } = await supabase.auth.signOut();
    
    // Clear user profile from local storage on sign out
    try {
      const { clearUserProfile } = await import('./offlineStorage');
      await clearUserProfile();
    } catch (error) {
      console.error('Error clearing user profile from local storage:', error);
      // Don't fail the sign out if local clear fails
    }
    
    return { error };
  }

  /**
   * Get current session
   */
  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }
    return data.session;
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<SupabaseUser | null> {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Error getting user:', error);
      return null;
    }
    return data.user;
  }

  /**
   * Update last login timestamp
   */
  private async updateLastLogin(authUserId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('users')
        .update({ lastLoginAt: new Date().toISOString() })
        .eq('auth_user_id', authUserId);

      if (error) {
        console.error('Error updating last login:', error);
      }
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }

  /**
   * Get user profile with full details including roles and permissions
   */
  async getUserProfile(authUserId: string): Promise<User | null> {
    try {
      // Fetch user from users table by auth_user_id
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', authUserId)
        .eq('isActive', true)
        .single();

      if (userError || !user) {
        console.error('Error fetching user:', userError);
        return null;
      }

      // Fetch user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          *,
          role:roles (
            id,
            name,
            description,
            level,
            isActive
          ),
          project:projects (
            id,
            name
          )
        `)
        .eq('userId', user.id)
        .eq('isActive', true);

      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
      }

      // Fetch user permissions
      const { data: userPermissions, error: userPermsError } = await supabase
        .from('user_permissions')
        .select(`
          *,
          permission:permissions (
            id,
            name,
            resource,
            action,
            scope
          )
        `)
        .eq('userId', user.id)
        .eq('isActive', true);

      if (userPermsError) {
        console.error('Error fetching user permissions:', userPermsError);
      }

      // Fetch role permissions
      const roleIds = userRoles?.map(ur => ur.roleId) || [];
      let rolePermissions: PermissionRow[] = [];

      if (roleIds.length > 0) {
        const { data: rolePerms, error: rolePermsError } = await supabase
          .from('role_permissions')
          .select(`
            permission:permissions (
              id,
              name,
              resource,
              action,
              scope
            )
          `)
          .in('roleId', roleIds);

        if (rolePermsError) {
          console.error('Error fetching role permissions:', rolePermsError);
        } else if (rolePerms) {
          rolePermissions = rolePerms
            .map((rp: any) => rp.permission)
            .filter((p): p is PermissionRow => p !== null);
        }
      }

      // Fetch project access
      const { data: projectAccess, error: projectAccessError } = await supabase
        .from('user_project_access')
        .select(`
          *,
          project:projects (
            id,
            name
          )
        `)
        .eq('userId', user.id)
        .eq('isActive', true);

      if (projectAccessError) {
        console.error('Error fetching project access:', projectAccessError);
      }

      // Transform to User type
      const userRolesFormatted: UserRole[] = (userRoles || []).map((ur: any) => ({
        id: ur.id,
        roleName: ur.role?.name || '',
        roleDescription: ur.role?.description || null,
        level: ur.role?.level || 0,
        projectId: ur.projectId || undefined,
        projectName: ur.project?.name || undefined,
        country: ur.country || undefined,
        isActive: ur.isActive,
      }));

      const projectAccessFormatted: ProjectAccess[] = (projectAccess || []).map((upa: any) => ({
        projectId: upa.projectId,
        projectName: upa.project?.name || undefined,
        accessLevel: upa.accessLevel as 'read' | 'write' | 'admin',
        isActive: upa.isActive,
      }));

      // Combine permissions from user and roles
      const allPermissions = [
        ...(userPermissions || []).map((up: any) => up.permission?.name || ''),
        ...rolePermissions.map((rp) => rp.name),
      ];

      const userProfile: User = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt || undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        organizationId: user.organizationid,
        roles: userRolesFormatted,
        projectAccess: projectAccessFormatted,
        permissions: Array.from(new Set(allPermissions)), // Remove duplicates
        // avatar field not available in database schema
      };

      // Save user profile to SQLite for offline sync operations
      try {
        await saveUserProfile(authUserId, user.id, user.organizationid);
      } catch (error) {
        console.error('Error saving user profile to local storage:', error);
        // Don't fail the operation if local save fails
      }

      return userProfile;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update({
        firstName: updates.firstName,
        lastName: updates.lastName,
        avatar: updates.avatar,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to update profile');
    }

    // Fetch full profile again
    const authUser = await this.getCurrentUser();
    if (!authUser) {
      throw new Error('Not authenticated');
    }

    const updatedProfile = await this.getUserProfile(authUser.id);
    if (!updatedProfile) {
      throw new Error('Failed to fetch updated profile');
    }

    return updatedProfile;
  }

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    // First verify current password
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Update password
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message || 'Failed to change password');
    }
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(
    callback: (event: string, session: Session | null) => void
  ): { data: { subscription: { unsubscribe: () => void } } } {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });

    return { data };
  }
}

export const supabaseAuthService = new SupabaseAuthService();


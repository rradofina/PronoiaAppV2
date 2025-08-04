/**
 * Session Template Service
 * Manages user-specific template customizations without modifying default packages
 * Uses the sessions + templates tables for user-specific state
 */

import { supabase } from '../lib/supabase/client';
import { ManualTemplate, Session } from '../types';
import { supabaseService } from './supabaseService';
import { manualPackageService } from './manualPackageService';

// UUID validation utility
function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

// UUID validation with detailed error
function validateUUID(value: string, fieldName: string): void {
  if (!value) {
    throw new Error(`${fieldName} is required`);
  }
  if (!isValidUUID(value)) {
    throw new Error(`${fieldName} must be a valid UUID format. Received: ${value}`);
  }
}

export interface SessionTemplate {
  id: string;
  session_id: string;
  position: number;
  template_id: string;
  template: ManualTemplate;
}

class SessionTemplateServiceImpl {
  /**
   * Get or create session for user's package customization
   */
  async getOrCreateSession(userId: string, packageId: string, clientName: string): Promise<string> {
    try {
      console.log('🔍 SESSION CREATION DEBUG - Validating parameters:', {
        userId,
        packageId,
        clientName,
        userIdIsUUID: isValidUUID(userId),
        packageIdIsUUID: isValidUUID(packageId)
      });

      // Validate UUIDs before database operations
      validateUUID(userId, 'userId');
      validateUUID(packageId, 'packageId');

      // Check if user already has a session for this package
      console.log('🔍 Querying existing sessions...');
      const { data: existingSessions, error: queryError } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('package_id', packageId)
        .eq('is_completed', false)
        .limit(1);

      if (queryError) {
        console.error('❌ Error querying existing sessions:', queryError);
        throw new Error(`Failed to query existing sessions: ${queryError.message}`);
      }

      if (existingSessions && existingSessions.length > 0) {
        console.log('✅ Using existing session:', existingSessions[0].id);
        return existingSessions[0].id;
      }

      console.log('🔄 No existing session found, creating new session...');

      // Create new session with validated UUIDs
      const sessionData = await supabaseService.createSession({
        user_id: userId,
        client_name: clientName,
        package_id: packageId,
        google_drive_folder_id: '', // Will be set later
        max_templates: 10, // Default max
      });

      console.log('✅ Created new session for template customization:', {
        sessionId: sessionData.id,
        userId,
        packageId,
        clientName
      });
      return sessionData.id;
    } catch (error) {
      console.error('❌ Comprehensive error in getOrCreateSession:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        userId,
        packageId,
        clientName
      });
      throw error;
    }
  }

  /**
   * Get session templates for a user's package customization
   * If no session templates exist, returns default package templates
   */
  async getSessionTemplates(userId: string, packageId: string, clientName: string): Promise<ManualTemplate[]> {
    try {
      const sessionId = await this.getOrCreateSession(userId, packageId, clientName);
      
      // Try to get session templates first
      const { data: sessionTemplates } = await supabase
        .from('session_templates')
        .select(`
          id,
          position,
          template_id,
          manual_templates (*)
        `)
        .eq('session_id', sessionId)
        .order('position', { ascending: true });

      if (sessionTemplates && sessionTemplates.length > 0) {
        console.log('📋 Found existing session templates:', sessionTemplates.length);
        return sessionTemplates
          .map(st => {
            // Handle both array and object responses from Supabase
            const template = Array.isArray(st.manual_templates) ? st.manual_templates[0] : st.manual_templates;
            return template as ManualTemplate;
          })
          .filter(Boolean);
      }

      // No session templates yet, return default package templates
      console.log('📋 No session templates found, using default package templates');
      const packageWithTemplates = await manualPackageService.getPackageWithTemplates(packageId);
      return packageWithTemplates?.templates || [];
    } catch (error) {
      console.error('❌ Error loading session templates:', error);
      // Fallback to default package templates
      const packageWithTemplates = await manualPackageService.getPackageWithTemplates(packageId);
      return packageWithTemplates?.templates || [];
    }
  }

  /**
   * Initialize session templates by copying default package templates
   */
  async initializeSessionTemplates(sessionId: string, packageId: string): Promise<void> {
    try {
      console.log('🔄 Initializing session templates from default package:', {
        sessionId,
        packageId,
        timestamp: new Date().toISOString()
      });
      
      // Get default package templates
      const packageWithTemplates = await manualPackageService.getPackageWithTemplates(packageId);
      if (!packageWithTemplates?.templates) {
        console.error('❌ No default templates found in package:', packageId);
        throw new Error(`No default templates found in package ${packageId}`);
      }

      console.log('📋 Default package templates found:', {
        packageId,
        templatesCount: packageWithTemplates.templates.length,
        templateIds: packageWithTemplates.templates.map(t => ({
          id: t.id,
          name: t.name,
          idType: typeof t.id
        }))
      });

      // Create session template records with proper position ordering
      const sessionTemplateInserts = packageWithTemplates.templates.map((template, index) => ({
        session_id: sessionId,
        position: index + 1, // 1-based positioning (1, 2, 3, ...)
        template_id: template.id.toString() // Ensure string type consistency
      }));

      console.log('📝 Inserting session template records:', {
        sessionId,
        insertsCount: sessionTemplateInserts.length,
        inserts: sessionTemplateInserts.map(insert => ({
          position: insert.position,
          template_id: insert.template_id
        }))
      });

      const { data: insertData, error: insertError } = await supabase
        .from('session_templates')
        .insert(sessionTemplateInserts)
        .select();

      if (insertError) {
        console.error('❌ Database insert error:', insertError);
        throw new Error(`Failed to initialize session templates: ${insertError.message}`);
      }

      console.log('✅ Session templates initialized successfully:', {
        sessionId,
        insertedCount: insertData?.length || 0,
        insertedTemplates: insertData?.map(t => ({
          position: t.position,
          template_id: t.template_id
        })) || []
      });
    } catch (error) {
      console.error('❌ Comprehensive error in initializeSessionTemplates:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        packageId
      });
      throw error;
    }
  }

  /**
   * Replace a template at specific position in user's session
   */
  async replaceSessionTemplate(
    userId: string, 
    packageId: string, 
    clientName: string,
    position: number, 
    newTemplateId: string
  ): Promise<void> {
    try {
      console.log('🔍 DETAILED SESSION TEMPLATE DEBUGGING - Starting replacement:', {
        userId,
        packageId,
        clientName,
        position,
        newTemplateId,
        newTemplateIdType: typeof newTemplateId,
        timestamp: new Date().toISOString()
      });

      // UUID Validation - Critical for database constraints
      console.log('🔍 UUID VALIDATION - Checking ID formats:');
      try {
        validateUUID(userId, 'userId');
        console.log('✅ userId UUID valid:', userId);
      } catch (error) {
        console.error('❌ userId UUID invalid:', error);
        throw error;
      }

      try {
        validateUUID(packageId, 'packageId');
        console.log('✅ packageId UUID valid:', packageId);
      } catch (error) {
        console.error('❌ packageId UUID invalid:', error);
        throw error;
      }

      try {
        validateUUID(newTemplateId, 'newTemplateId');
        console.log('✅ newTemplateId UUID valid:', newTemplateId);
      } catch (error) {
        console.error('❌ newTemplateId UUID invalid:', error);
        throw error;
      }
      
      const sessionId = await this.getOrCreateSession(userId, packageId, clientName);
      console.log('📋 Session ID obtained:', sessionId);
      
      // Get ALL existing session templates to understand current state
      const { data: initialSessionTemplates, error: selectError } = await supabase
        .from('session_templates')
        .select('id, position, template_id')
        .eq('session_id', sessionId)
        .order('position', { ascending: true });

      if (selectError) {
        console.error('❌ Error querying session templates:', selectError);
        throw new Error(`Failed to query session templates: ${selectError.message}`);
      }

      // Track current session templates (mutable)
      let allSessionTemplates = initialSessionTemplates;

      console.log('📋 Current session templates:', {
        sessionId,
        templatesFound: allSessionTemplates?.length || 0,
        templates: allSessionTemplates?.map(t => ({
          id: t.id,
          position: t.position,
          template_id: t.template_id
        })) || []
      });

      // Initialize session templates if none exist
      if (!allSessionTemplates || allSessionTemplates.length === 0) {
        console.log('🔄 No session templates found, initializing...');
        await this.initializeSessionTemplates(sessionId, packageId);
        
        // Re-query after initialization to get the updated list
        const { data: requeriedTemplates } = await supabase
          .from('session_templates')
          .select('id, position, template_id')
          .eq('session_id', sessionId)
          .order('position', { ascending: true });
        
        console.log('📋 Templates after initialization:', {
          templatesFound: requeriedTemplates?.length || 0,
          templates: requeriedTemplates?.map(t => ({
            position: t.position,
            template_id: t.template_id
          })) || []
        });
        
        // Update the allSessionTemplates variable with the newly initialized data
        allSessionTemplates = requeriedTemplates || [];
      }

      // Validate that the position exists
      const targetTemplate = allSessionTemplates?.find(t => t.position === position);
      if (!targetTemplate) {
        console.error('❌ Position validation failed:', {
          requestedPosition: position,
          availablePositions: allSessionTemplates?.map(t => t.position) || [],
          totalTemplates: allSessionTemplates?.length || 0
        });
        throw new Error(`Position ${position} does not exist. Available positions: ${allSessionTemplates?.map(t => t.position).join(', ') || 'none'}`);
      }

      console.log('✅ Position validation passed:', {
        targetPosition: position,
        currentTemplateId: targetTemplate.template_id,
        newTemplateId
      });

      // Validate that the new template actually exists in the database
      console.log('🔍 Validating new template exists in database...');
      const { data: templateExists, error: templateCheckError } = await supabase
        .from('manual_templates')
        .select('id, name')
        .eq('id', newTemplateId)
        .eq('is_active', true)
        .limit(1);

      if (templateCheckError) {
        console.error('❌ Error checking template existence:', templateCheckError);
        throw new Error(`Failed to validate template existence: ${templateCheckError.message}`);
      }

      if (!templateExists || templateExists.length === 0) {
        console.error('❌ Template does not exist or is inactive:', {
          newTemplateId,
          templateExists
        });
        throw new Error(`Template ${newTemplateId} does not exist or is not active`);
      }

      console.log('✅ New template validated:', {
        templateId: templateExists[0].id,
        templateName: templateExists[0].name
      });

      // Update the template at the specific position
      const { data: updateData, error: updateError, count } = await supabase
        .from('session_templates')
        .update({ template_id: newTemplateId })
        .eq('session_id', sessionId)
        .eq('position', position)
        .select();

      if (updateError) {
        console.error('❌ Database update error:', updateError);
        throw new Error(`Failed to replace session template: ${updateError.message}`);
      }

      console.log('🔍 Database update result:', {
        updateData,
        affectedRows: count,
        updateSuccess: !!updateData && updateData.length > 0
      });

      // Validate that the update actually affected rows
      if (!updateData || updateData.length === 0) {
        throw new Error(`Update succeeded but affected 0 rows. Position ${position} may not exist in session ${sessionId}`);
      }

      console.log('✅ Session template replaced successfully:', {
        sessionId,
        position,
        oldTemplateId: targetTemplate.template_id,
        newTemplateId,
        affectedRows: updateData.length
      });
    } catch (error) {
      console.error('❌ Comprehensive error in replaceSessionTemplate:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        packageId,
        position,
        newTemplateId
      });
      throw error;
    }
  }

  /**
   * Add a new template to user's session at the end
   */
  async addTemplateToSession(
    userId: string,
    packageId: string,
    clientName: string,
    newTemplateId: string
  ): Promise<void> {
    try {
      console.log('➕ Adding template to session:', { newTemplateId });
      
      const sessionId = await this.getOrCreateSession(userId, packageId, clientName);
      
      // Check if session templates exist, if not initialize them
      const { data: existingSessionTemplates } = await supabase
        .from('session_templates')
        .select('position')
        .eq('session_id', sessionId)
        .order('position', { ascending: false })
        .limit(1);

      let nextPosition = 1;
      
      if (!existingSessionTemplates || existingSessionTemplates.length === 0) {
        // No session templates yet, initialize from defaults first
        await this.initializeSessionTemplates(sessionId, packageId);
        
        // Get the highest position after initialization
        const { data: afterInit } = await supabase
          .from('session_templates')
          .select('position')
          .eq('session_id', sessionId)
          .order('position', { ascending: false })
          .limit(1);
          
        nextPosition = afterInit && afterInit.length > 0 ? afterInit[0].position + 1 : 1;
      } else {
        // Calculate next position
        nextPosition = existingSessionTemplates[0].position + 1;
      }

      console.log('📍 Adding template at position:', nextPosition);

      // Insert new template at the end
      const { error } = await supabase
        .from('session_templates')
        .insert({
          session_id: sessionId,
          position: nextPosition,
          template_id: newTemplateId
        });

      if (error) {
        throw new Error(`Failed to add session template: ${error.message}`);
      }

      console.log('✅ Template added to session successfully at position:', nextPosition);
    } catch (error) {
      console.error('❌ Error adding template to session:', error);
      throw error;
    }
  }
}

export const sessionTemplateService = new SessionTemplateServiceImpl();
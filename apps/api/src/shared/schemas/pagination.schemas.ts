import { createSchema } from '@ai-assistant/utils';
import type { ValidationSchema } from '@ai-assistant/utils';

/**
 * Schema for pagination query parameters
 */
export const paginationQuerySchema: ValidationSchema = createSchema({
  page: {
    type: 'number' as const,
    min: 1,
    message: 'Page must be a positive number starting from 1',
  },
  limit: {
    type: 'number' as const,
    min: 1,
    max: 100,
    message: 'Limit must be between 1 and 100',
  },
  sortBy: {
    type: 'string' as const,
    minLength: 1,
    message: 'Sort field name is required if provided',
  },
  sortOrder: {
    type: 'string' as const,
    validator: (value: unknown) => value === 'asc' || value === 'desc',
    message: 'Sort order must be either "asc" or "desc"',
  },
});

/**
 * Schema for search with pagination
 */
export const searchPaginationSchema: ValidationSchema = createSchema({
  q: {
    type: 'string' as const,
    minLength: 1,
    maxLength: 500,
    message: 'Search query must be 1-500 characters',
  },
  page: {
    type: 'number' as const,
    min: 1,
    message: 'Page must be a positive number starting from 1',
  },
  limit: {
    type: 'number' as const,
    min: 1,
    max: 50, // Smaller limit for search results
    message: 'Limit must be between 1 and 50 for search',
  },
  filters: {
    type: 'object' as const,
    message: 'Filters must be a valid object',
  },
});

/**
 * Schema for date range with pagination
 */
export const dateRangePaginationSchema: ValidationSchema = createSchema({
  startDate: {
    type: 'date' as const,
    message: 'Start date must be a valid date',
  },
  endDate: {
    type: 'date' as const,
    message: 'End date must be a valid date',
  },
  page: {
    type: 'number' as const,
    min: 1,
    message: 'Page must be a positive number starting from 1',
  },
  limit: {
    type: 'number' as const,
    min: 1,
    max: 100,
    message: 'Limit must be between 1 and 100',
  },
});

/**
 * Schema for user listing with pagination
 */
export const userListPaginationSchema: ValidationSchema = createSchema({
  page: {
    type: 'number' as const,
    min: 1,
    message: 'Page must be a positive number starting from 1',
  },
  limit: {
    type: 'number' as const,
    min: 1,
    max: 50,
    message: 'Limit must be between 1 and 50 for user listings',
  },
  role: {
    type: 'string' as const,
    validator: (value: unknown) => value === 'USER' || value === 'ADMIN',
    message: 'Role filter must be either "USER" or "ADMIN"',
  },
  status: {
    type: 'string' as const,
    validator: (value: unknown) =>
      value === 'active' || value === 'inactive' || value === 'suspended',
    message: 'Status filter must be "active", "inactive", or "suspended"',
  },
  sortBy: {
    type: 'string' as const,
    validator: (value: unknown) =>
      value === 'createdAt' ||
      value === 'name' ||
      value === 'email' ||
      value === 'lastActiveAt',
    message:
      'Sort field must be "createdAt", "name", "email", or "lastActiveAt"',
  },
  sortOrder: {
    type: 'string' as const,
    validator: (value: unknown) => value === 'asc' || value === 'desc',
    message: 'Sort order must be either "asc" or "desc"',
  },
});

/**
 * Schema for workspace listing with pagination
 */
export const workspaceListPaginationSchema: ValidationSchema = createSchema({
  page: {
    type: 'number' as const,
    min: 1,
    message: 'Page must be a positive number starting from 1',
  },
  limit: {
    type: 'number' as const,
    min: 1,
    max: 50,
    message: 'Limit must be between 1 and 50 for workspace listings',
  },
  memberRole: {
    type: 'string' as const,
    validator: (value: unknown) =>
      value === 'MEMBER' || value === 'ADMIN' || value === 'OWNER',
    message: 'Member role filter must be "MEMBER", "ADMIN", or "OWNER"',
  },
  sortBy: {
    type: 'string' as const,
    validator: (value: unknown) =>
      value === 'createdAt' ||
      value === 'name' ||
      value === 'memberCount' ||
      value === 'lastActivityAt',
    message:
      'Sort field must be "createdAt", "name", "memberCount", or "lastActivityAt"',
  },
  sortOrder: {
    type: 'string' as const,
    validator: (value: unknown) => value === 'asc' || value === 'desc',
    message: 'Sort order must be either "asc" or "desc"',
  },
});

/**
 * Schema for AI conversation history pagination
 */
export const aiConversationPaginationSchema: ValidationSchema = createSchema({
  page: {
    type: 'number' as const,
    min: 1,
    message: 'Page must be a positive number starting from 1',
  },
  limit: {
    type: 'number' as const,
    min: 1,
    max: 20, // Smaller limit for conversation history
    message: 'Limit must be between 1 and 20 for conversation history',
  },
  conversationType: {
    type: 'string' as const,
    validator: (value: unknown) =>
      value === 'chat' || value === 'analysis' || value === 'knowledge_query',
    message:
      'Conversation type must be "chat", "analysis", or "knowledge_query"',
  },
  startDate: {
    type: 'date' as const,
    message: 'Start date must be a valid date',
  },
  endDate: {
    type: 'date' as const,
    message: 'End date must be a valid date',
  },
});

/**
 * Schema for knowledge base pagination
 */
export const knowledgePaginationSchema: ValidationSchema = createSchema({
  page: {
    type: 'number' as const,
    min: 1,
    message: 'Page must be a positive number starting from 1',
  },
  limit: {
    type: 'number' as const,
    min: 1,
    max: 30,
    message: 'Limit must be between 1 and 30 for knowledge items',
  },
  category: {
    type: 'string' as const,
    minLength: 1,
    message: 'Category filter must not be empty',
  },
  tags: {
    type: 'array' as const,
    message: 'Tags must be an array of strings',
  },
  contentType: {
    type: 'string' as const,
    validator: (value: unknown) =>
      value === 'document' ||
      value === 'note' ||
      value === 'link' ||
      value === 'file',
    message: 'Content type must be "document", "note", "link", or "file"',
  },
  sortBy: {
    type: 'string' as const,
    validator: (value: unknown) =>
      value === 'createdAt' ||
      value === 'updatedAt' ||
      value === 'title' ||
      value === 'relevance',
    message:
      'Sort field must be "createdAt", "updatedAt", "title", or "relevance"',
  },
  sortOrder: {
    type: 'string' as const,
    validator: (value: unknown) => value === 'asc' || value === 'desc',
    message: 'Sort order must be either "asc" or "desc"',
  },
});

/**
 * All pagination schemas for easy import
 */
export const PaginationSchemas = {
  basic: paginationQuerySchema,
  search: searchPaginationSchema,
  dateRange: dateRangePaginationSchema,
  userList: userListPaginationSchema,
  workspaceList: workspaceListPaginationSchema,
  aiConversation: aiConversationPaginationSchema,
  knowledge: knowledgePaginationSchema,
} as const;

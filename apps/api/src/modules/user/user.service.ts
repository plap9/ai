import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../shared/database/database.service';
import { CacheService } from '../../shared/cache/cache.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto';
import { hash, compare } from 'bcrypt';
import { User, UserRole } from '@prisma/client';
import {
  SafeParser,
  isUUID,
  isEmail,
  isNonEmptyString,
} from '@ai-assistant/utils';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly CACHE_PREFIX = 'user';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
  ) {}

  async findById(id: string): Promise<UserResponseDto | null> {
    try {
      // Type-safe ID validation
      if (!isUUID(id)) {
        const invalidId = String(id).substring(0, 20); // Safe string conversion
        this.logger.warn(`Invalid UUID provided: ${invalidId}`);
        throw new BadRequestException('Invalid user ID format');
      }

      // Try cache first
      const cacheKey = this.cacheService.generateKey(
        this.CACHE_PREFIX,
        'id',
        id,
      );
      const cachedUser = await this.cacheService.get<UserResponseDto>(cacheKey);
      if (cachedUser) {
        this.logger.debug(`User found in cache: ${id}`);
        return cachedUser;
      }

      // Query database
      const user = await this.databaseService.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return null;
      }

      // Cache the result
      await this.cacheService.set(cacheKey, user, this.CACHE_TTL);
      this.logger.debug(`User cached: ${id}`);

      return user;
    } catch (error) {
      this.logger.error(`Error finding user by ID ${id}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to find user: ${errorMessage}`);
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      // Type-safe email validation
      if (!isEmail(email)) {
        const safeEmail = String(email).substring(0, 50); // Safe string conversion
        this.logger.warn(`Invalid email format provided: ${safeEmail}`);
        throw new BadRequestException('Invalid email format');
      }

      const user = await this.databaseService.user.findUnique({
        where: { email },
      });

      return user;
    } catch (error) {
      this.logger.error(`Error finding user by email ${email}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to find user by email: ${errorMessage}`);
    }
  }

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    try {
      // Type-safe validation using SafeParser
      const parser = new SafeParser(createUserDto);

      const email = parser.getEmail('email');
      const name = parser.getNonEmptyString('name');
      const password = parser.getNonEmptyString('password');

      if (!email) {
        throw new BadRequestException('Valid email is required');
      }
      if (!name) {
        throw new BadRequestException('Name is required');
      }
      if (!password || password.length < 8) {
        throw new BadRequestException('Password must be at least 8 characters');
      }

      // Check if user already exists
      const existingUser = await this.findByEmail(email);
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await hash(password, 12);

      // Create user
      const user = await this.databaseService.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          role: (parser.getString('role', 'USER') as UserRole) || UserRole.USER,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Cache the user
      const cacheKey = this.cacheService.generateKey(
        this.CACHE_PREFIX,
        'id',
        user.id,
      );
      await this.cacheService.set(cacheKey, user, this.CACHE_TTL);

      this.logger.log(`User created successfully: ${user.email}`);
      return user;
    } catch (error) {
      this.logger.error(`Error creating user:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create user: ${errorMessage}`);
    }
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    try {
      // Type-safe ID validation
      if (!isUUID(id)) {
        throw new BadRequestException('Invalid user ID format');
      }

      // Check if user exists
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      // Type-safe validation using SafeParser
      const parser = new SafeParser(updateUserDto);
      const updateData: Partial<UpdateUserDto> = {};

      // Only update provided fields with validation
      const email = parser.getEmail('email');
      if (email && email !== existingUser.email) {
        const userWithEmail = await this.findByEmail(email);
        if (userWithEmail) {
          throw new ConflictException('User with this email already exists');
        }
        updateData.email = email;
      }

      const name = parser.getString('name');
      if (name && isNonEmptyString(name)) {
        updateData.name = name;
      }

      const role = parser.getString('role');
      if (
        role &&
        isNonEmptyString(role) &&
        Object.values(UserRole).includes(role as UserRole)
      ) {
        updateData.role = role as UserRole;
      }

      // Update user
      const user = await this.databaseService.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Update cache
      const cacheKey = this.cacheService.generateKey(
        this.CACHE_PREFIX,
        'id',
        id,
      );
      await this.cacheService.set(cacheKey, user, this.CACHE_TTL);

      this.logger.log(`User updated successfully: ${id}`);
      return user;
    } catch (error) {
      this.logger.error(`Error updating user ${id}:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update user: ${errorMessage}`);
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      // Type-safe ID validation
      if (!isUUID(id)) {
        throw new BadRequestException('Invalid user ID format');
      }

      // Check if user exists
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      // Delete user
      await this.databaseService.user.delete({
        where: { id },
      });

      // Remove from cache
      const cacheKey = this.cacheService.generateKey(
        this.CACHE_PREFIX,
        'id',
        id,
      );
      await this.cacheService.del(cacheKey);

      this.logger.log(`User deleted successfully: ${id}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting user ${id}:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete user: ${errorMessage}`);
    }
  }

  async validatePassword(
    email: string,
    password: string,
  ): Promise<User | null> {
    try {
      // Type-safe validation
      if (!isEmail(email)) {
        const safeEmail = String(email).substring(0, 50); // Safe string conversion
        this.logger.warn(`Invalid email format for validation: ${safeEmail}`);
        return null;
      }

      if (!isNonEmptyString(password)) {
        this.logger.warn('Empty password provided for validation');
        return null;
      }

      const user = await this.findByEmail(email);
      if (!user) {
        return null;
      }

      const isPasswordValid = await compare(password, user.password);
      if (!isPasswordValid) {
        return null;
      }

      this.logger.debug(`Password validated for user: ${email}`);
      return user;
    } catch (error) {
      this.logger.error(`Error validating password for ${email}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to validate password: ${errorMessage}`);
    }
  }

  async updatePassword(id: string, newPassword: string): Promise<boolean> {
    try {
      // Type-safe validation
      if (!isUUID(id)) {
        throw new BadRequestException('Invalid user ID format');
      }

      if (!isNonEmptyString(newPassword) || newPassword.length < 8) {
        throw new BadRequestException('Password must be at least 8 characters');
      }

      const hashedPassword = await hash(newPassword, 12);

      await this.databaseService.user.update({
        where: { id },
        data: { password: hashedPassword },
      });

      this.logger.log(`Password updated for user: ${id}`);
      return true;
    } catch (error) {
      this.logger.error(`Error updating password for user ${id}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update password: ${errorMessage}`);
    }
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../shared/database/database.service';
import { CacheService } from '../../shared/cache/cache.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto';
import { hash, compare } from 'bcrypt';
import { User } from '@prisma/client';

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
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.databaseService.user.findUnique({
        where: { email },
      });

      return user;
    } catch (error) {
      this.logger.error(`Error finding user by email ${email}:`, error);
      throw error;
    }
  }

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    try {
      // Check if user already exists
      const existingUser = await this.findByEmail(createUserDto.email);
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await hash(createUserDto.password, 12);

      // Create user
      const user = await this.databaseService.user.create({
        data: {
          ...createUserDto,
          password: hashedPassword,
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
      throw error;
    }
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    try {
      // Check if user exists
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      // Check email conflict if email is being updated
      if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
        const userWithEmail = await this.findByEmail(updateUserDto.email);
        if (userWithEmail) {
          throw new ConflictException('User with this email already exists');
        }
      }

      // Update user
      const user = await this.databaseService.user.update({
        where: { id },
        data: updateUserDto,
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
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
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
      throw error;
    }
  }

  async validatePassword(
    email: string,
    password: string,
  ): Promise<User | null> {
    try {
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
      throw error;
    }
  }

  async updatePassword(id: string, newPassword: string): Promise<boolean> {
    try {
      const hashedPassword = await hash(newPassword, 12);

      await this.databaseService.user.update({
        where: { id },
        data: { password: hashedPassword },
      });

      this.logger.log(`Password updated for user: ${id}`);
      return true;
    } catch (error) {
      this.logger.error(`Error updating password for user ${id}:`, error);
      throw error;
    }
  }
}

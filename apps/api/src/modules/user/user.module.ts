import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserResolver } from './user.resolver';
import { DatabaseModule } from '../../shared/database';
import { CacheModule } from '../../shared/cache';

@Module({
  imports: [DatabaseModule, CacheModule],
  controllers: [UserController],
  providers: [UserService, UserResolver],
  exports: [UserService],
})
export class UserModule {}

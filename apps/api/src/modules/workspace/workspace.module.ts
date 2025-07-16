import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { UserModule } from '../user/user.module';
import { DatabaseModule } from '../../shared/database';
import { CacheModule } from '../../shared/cache';

@Module({
  imports: [UserModule, DatabaseModule, CacheModule],
  providers: [WorkspaceService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}

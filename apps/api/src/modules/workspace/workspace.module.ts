import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceResolver } from './workspace.resolver';
import { UserModule } from '../user/user.module';
import { DatabaseModule } from '../../shared/database';
import { CacheModule } from '../../shared/cache';

@Module({
  imports: [UserModule, DatabaseModule, CacheModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, WorkspaceResolver],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}

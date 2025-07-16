import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Shared modules
import { DatabaseModule } from './shared/database';
import { CacheModule } from './shared/cache';
import { QueueModule } from './shared/queue';
import { CommonModule } from './shared/common';

// Business modules
import { UserModule } from './modules/user';
import { AuthModule } from './modules/auth';
import { WorkspaceModule } from './modules/workspace';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Shared modules
    DatabaseModule,
    CacheModule,
    QueueModule,
    CommonModule,

    // Business modules
    UserModule,
    AuthModule,
    WorkspaceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

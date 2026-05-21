import { Module } from '@nestjs/common'
import { SocialPostsService } from './social-posts.service'

@Module({
  providers: [SocialPostsService],
  exports: [SocialPostsService],
})
export class SocialModule {}

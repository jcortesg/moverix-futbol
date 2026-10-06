import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger'
import { MobileFeedService } from './mobile-feed.service'
import { MobileReactionsService, REACTION_TYPES } from './mobile-reactions.service'
import { MobileCommentsService } from './mobile-comments.service'

@ApiTags('mobile')
@ApiBearerAuth()
@Controller('mobile/feed')
export class MobileFeedController {
  constructor(
    private readonly service: MobileFeedService,
    private readonly reactions: MobileReactionsService,
    private readonly comments: MobileCommentsService,
  ) {}

  @Get()
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getFeed(@Req() req: any, @Query('limit') limit?: string) {
    return this.service.getFeed(req.user.uid, limit ? parseInt(limit) : 30)
  }

  /**
   * Reacciona a una publicación o a un evento suyo (un gol concreto).
   * Enviar el mismo tipo dos veces quita la reacción.
   */
  @Post('posts/:postId/reactions')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: [...REACTION_TYPES] },
        targetId: { type: 'string', description: 'id del match_event; omitir para reaccionar a toda la tarjeta' },
      },
      required: ['type'],
    },
  })
  react(
    @Req() req: any,
    @Param('postId') postId: string,
    @Body() body: { type: string; targetId?: string },
  ) {
    return this.reactions.react(req.user.uid, postId, body?.type, body?.targetId)
  }

  /** Reacciones propias en un post, para pintar el estado en la UI. */
  @Get('posts/:postId/reactions/me')
  myReactions(@Req() req: any, @Param('postId') postId: string) {
    return this.reactions.myReactions(req.user.uid, postId)
  }

  /**
   * Catálogo de reacciones. La app lo consulta en vez de hardcodearlo, así
   * agregar o quitar una no obliga a recompilar y resubir a las tiendas.
   */
  @Get('reactions/catalog')
  reactionCatalog() {
    return this.reactions.catalog()
  }

  // ── Comentarios ────────────────────────────────────────

  /** Publica un comentario (solo los equipos que jugaron el partido). */
  @Post('posts/:postId/comments')
  @ApiBody({
    schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  })
  addComment(
    @Req() req: any,
    @Param('postId') postId: string,
    @Body() body: { text: string },
  ) {
    return this.comments.create(req.user.uid, postId, body?.text)
  }

  /** Lista comentarios visibles (oculta borrados, ocultos y bloqueados). */
  @Get('posts/:postId/comments')
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listComments(
    @Req() req: any,
    @Param('postId') postId: string,
    @Query('limit') limit?: string,
  ) {
    return this.comments.list(req.user.uid, postId, limit ? parseInt(limit) : 50)
  }

  /** Elimina un comentario: autor u organizador del torneo. */
  @Delete('posts/:postId/comments/:commentId')
  removeComment(
    @Req() req: any,
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.comments.remove(req.user.uid, postId, commentId)
  }

  /** Me gusta a un comentario (toggle). */
  @Post('posts/:postId/comments/:commentId/like')
  likeComment(
    @Req() req: any,
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.comments.toggleLike(req.user.uid, postId, commentId)
  }

  /** Comentarios de este hilo a los que el usuario dio me gusta. */
  @Get('posts/:postId/comments/likes/me')
  myCommentLikes(@Req() req: any, @Param('postId') postId: string) {
    return this.comments.myLikes(req.user.uid, postId)
  }

  /** Reporta un comentario ofensivo (App Store 1.2). */
  @Post('posts/:postId/comments/:commentId/report')
  @ApiBody({
    schema: { type: 'object', properties: { reason: { type: 'string' } } },
    required: false,
  })
  reportComment(
    @Req() req: any,
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @Body() body: { reason?: string },
  ) {
    return this.comments.report(req.user.uid, postId, commentId, body?.reason)
  }

  // ── Bloqueo de usuarios (App Store 1.2) ────────────────

  @Post('blocks/:targetUid')
  block(@Req() req: any, @Param('targetUid') targetUid: string) {
    return this.comments.block(req.user.uid, targetUid)
  }

  @Delete('blocks/:targetUid')
  unblock(@Req() req: any, @Param('targetUid') targetUid: string) {
    return this.comments.unblock(req.user.uid, targetUid)
  }

  @Get('blocks')
  listBlocked(@Req() req: any) {
    return this.comments.listBlocked(req.user.uid)
  }
}

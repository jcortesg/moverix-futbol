import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Image } from 'expo-image'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../../components/ui/Card'
import { colors, fonts, fontSize, spacing } from '../../lib/theme'

interface FeedContext {
  matchId?: string
  teamId?: string
  tournamentId?: string
  tournamentName?: string | null
  playerId?: string | null
  playerName?: string | null
  teamName?: string | null
  homeTeam?: { id: string; name: string; logoUrl: string | null }
  awayTeam?: { id: string; name: string; logoUrl: string | null }
  homeScore?: number | null
  awayScore?: number | null
  minute?: number | null
}

interface FeedItem {
  id: string
  type: string
  text: string
  createdAt: string
  context: FeedContext
  imageUrl: string | null
  imageType: 'player' | 'team' | 'edition'
}

const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
  goal: { icon: 'soccer', color: colors.green.primary },
  penalty_scored: { icon: 'soccer', color: colors.green.primary },
  own_goal: { icon: 'soccer', color: colors.stat.orange },
  red_card: { icon: 'card', color: colors.result.loss },
  mvp: { icon: 'star', color: '#FFD700' },
  match_result: { icon: 'whistle', color: colors.stat.blue },
  penalty_missed: { icon: 'soccer', color: colors.text.muted },
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)

  if (diff < 60) return 'ahora'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(dateStr).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

function FeedAvatar({ item }: { item: FeedItem }) {
  if (item.imageUrl) {
    return (
      <Image
        source={{ uri: item.imageUrl }}
        style={styles.avatar}
        contentFit="cover"
      />
    )
  }

  // Fallback icon based on type
  const iconName = item.imageType === 'player' ? 'account-circle' : 'shield'
  return (
    <View style={styles.avatarFallback}>
      <MaterialCommunityIcons name={iconName} size={24} color={colors.text.muted} />
    </View>
  )
}

function EventIcon({ type }: { type: string }) {
  const config = EVENT_ICONS[type] ?? { icon: 'bell', color: colors.text.muted }
  return (
    <View style={[styles.eventIcon, { backgroundColor: config.color + '20' }]}>
      <MaterialCommunityIcons
        name={config.icon as any}
        size={12}
        color={config.color}
      />
    </View>
  )
}

function MatchResultCard({ item }: { item: FeedItem }) {
  const ctx = item.context
  return (
    <Card style={styles.matchResultCard}>
      <View style={styles.matchResultHeader}>
        <Text style={styles.matchResultLabel}>RESULTADO FINAL</Text>
        <Text style={styles.timeAgo}>{timeAgo(item.createdAt)}</Text>
      </View>

      <View style={styles.matchTeams}>
        <View style={styles.matchTeamCol}>
          {ctx.homeTeam?.logoUrl ? (
            <Image source={{ uri: ctx.homeTeam.logoUrl }} style={styles.matchTeamLogo} />
          ) : (
            <View style={styles.matchTeamLogoFallback}>
              <MaterialCommunityIcons name="shield" size={28} color={colors.text.muted} />
            </View>
          )}
          <Text style={styles.matchTeamName} numberOfLines={1}>
            {ctx.homeTeam?.name ?? 'Local'}
          </Text>
        </View>

        <View style={styles.matchScoreCol}>
          <Text style={styles.matchScore}>
            {ctx.homeScore ?? 0} - {ctx.awayScore ?? 0}
          </Text>
        </View>

        <View style={styles.matchTeamCol}>
          {ctx.awayTeam?.logoUrl ? (
            <Image source={{ uri: ctx.awayTeam.logoUrl }} style={styles.matchTeamLogo} />
          ) : (
            <View style={styles.matchTeamLogoFallback}>
              <MaterialCommunityIcons name="shield" size={28} color={colors.text.muted} />
            </View>
          )}
          <Text style={styles.matchTeamName} numberOfLines={1}>
            {ctx.awayTeam?.name ?? 'Visitante'}
          </Text>
        </View>
      </View>

      {ctx.tournamentName && (
        <Text style={styles.matchTournament}>{ctx.tournamentName}</Text>
      )}
    </Card>
  )
}

function ActivityCard({ item }: { item: FeedItem }) {
  return (
    <Card style={styles.activityCard}>
      <View style={styles.activityRow}>
        <View style={styles.avatarContainer}>
          <FeedAvatar item={item} />
          <EventIcon type={item.type} />
        </View>

        <View style={styles.activityContent}>
          <Text style={styles.activityText}>{item.text}</Text>
          <View style={styles.activityMeta}>
            {item.context.tournamentName && (
              <Text style={styles.tournamentName} numberOfLines={1}>
                {item.context.tournamentName}
              </Text>
            )}
            <Text style={styles.timeAgo}>{timeAgo(item.createdAt)}</Text>
          </View>
        </View>
      </View>
    </Card>
  )
}

function FeedCard({ item }: { item: FeedItem }) {
  if (item.type === 'match_result') {
    return <MatchResultCard item={item} />
  }
  return <ActivityCard item={item} />
}

export default function HomeScreen() {
  const { data: feed, isLoading, refetch } = useQuery({
    queryKey: ['feed'],
    queryFn: async () => {
      const { data } = await api.get('/mobile/feed', { params: { limit: 30 } })
      return data as FeedItem[]
    },
  })

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0B3D2E', colors.bg.primary]}
        style={styles.headerGradient}
      />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.headerLogo}
            contentFit="contain"
          />
        </View>

        <FlatList
          data={feed ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FeedCard item={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={colors.green.primary}
            />
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.empty}>
                <MaterialCommunityIcons name="lightning-bolt-outline" size={56} color={colors.text.muted} />
                <Text style={styles.emptyTitle}>Sin actividad</Text>
                <Text style={styles.emptySubtitle}>
                  Inscribete en un torneo para ver la actividad aqui
                </Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  safe: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerLogo: {
    width: 120,
    height: 40,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },

  // Match result card
  matchResultCard: {
    gap: spacing.sm,
  },
  matchResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchResultLabel: {
    fontFamily: fonts.label,
    fontSize: fontSize.xs,
    color: colors.stat.blue,
    letterSpacing: 1,
  },
  matchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  matchTeamCol: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  matchTeamLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  matchTeamLogoFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchTeamName: {
    fontFamily: fonts.label,
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  matchScoreCol: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  matchScore: {
    fontFamily: fonts.stats,
    fontSize: 28,
    color: colors.text.primary,
    letterSpacing: 2,
  },
  matchTournament: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.text.muted,
    textAlign: 'center',
  },

  // Activity card
  activityCard: {
    paddingVertical: spacing.sm + 2,
  },
  activityRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg.card,
  },
  activityContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  activityText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.text.primary,
    lineHeight: 20,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tournamentName: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.text.muted,
    flex: 1,
  },
  timeAgo: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },

  // Empty state
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 100,
    gap: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSize.lg,
    color: colors.text.secondary,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
  },
})

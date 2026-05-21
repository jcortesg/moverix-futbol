import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useEditionStore, useAuthStore } from '../../lib/store'
import { Card } from '../../components/ui/Card'
import { colors, fonts, fontSize, spacing, radius } from '../../lib/theme'

interface Player {
  id: string
  playerName: string
  jerseyNumber: number | null
  position: string | null
  isCaptain: boolean
}

interface TeamInfo {
  id: string
  name: string
  logoUrl: string | null
  primaryColor: string | null
  players: Player[]
}

function PlayerRow({ player }: { player: Player }) {
  return (
    <View style={styles.playerRow}>
      <View style={styles.jerseyBadge}>
        <Text style={styles.jerseyNumber}>{player.jerseyNumber ?? '—'}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>
          {player.playerName}
          {player.isCaptain && ' (C)'}
        </Text>
        {player.position && <Text style={styles.playerPos}>{player.position}</Text>}
      </View>
    </View>
  )
}

export default function EquipoScreen() {
  const editionId = useEditionStore((s) => s.editionId)
  const user = useAuthStore((s) => s.user)

  const { data: team, isLoading, refetch } = useQuery({
    queryKey: ['my-team', editionId],
    queryFn: async () => {
      if (!editionId) return null
      const { data } = await api.get('/registrations', { params: { editionId } })
      // Find the registration where the current user's team is
      const regs = data as any[]
      const myReg = regs.find(
        (r: any) => r.team?.directorUid === user?.uid,
      )
      if (!myReg) return null
      // Fetch roster
      const { data: players } = await api.get(
        `/registrations/${myReg.id}/players`,
      )
      return {
        id: myReg.team.id,
        name: myReg.team.name,
        logoUrl: myReg.team.logoUrl,
        primaryColor: myReg.team.primaryColor,
        players: players as Player[],
      } as TeamInfo
    },
    enabled: !!editionId && !!user,
  })

  if (!editionId) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="shield-off-outline" size={64} color={colors.text.muted} />
        <Text style={styles.emptyTitle}>Selecciona un torneo</Text>
        <Text style={styles.emptySubtitle}>
          Ve a Torneos para elegir la edición activa
        </Text>
      </View>
    )
  }

  if (!isLoading && !team) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="account-group-outline" size={64} color={colors.text.muted} />
        <Text style={styles.emptyTitle}>Sin equipo</Text>
        <Text style={styles.emptySubtitle}>
          No estás registrado en este torneo
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={team?.players ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.green.primary}
          />
        }
        ListHeaderComponent={
          team ? (
            <Card glow style={styles.teamHeader}>
              <View style={styles.teamRow}>
                <View style={styles.teamLogo}>
                  {team.logoUrl ? (
                    <Image source={{ uri: team.logoUrl }} style={styles.logoImg} />
                  ) : (
                    <MaterialCommunityIcons
                      name="shield-half-full"
                      size={40}
                      color={colors.green.primary}
                    />
                  )}
                </View>
                <View>
                  <Text style={styles.teamName}>{team.name}</Text>
                  <Text style={styles.teamCount}>
                    {team.players.length} jugadores
                  </Text>
                </View>
              </View>
            </Card>
          ) : null
        }
        renderItem={({ item }) => <PlayerRow player={item} />}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  list: { padding: spacing.md, gap: spacing.sm },
  teamHeader: { marginBottom: spacing.md, borderColor: colors.green.primary },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  teamLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: { width: 48, height: 48, borderRadius: 24 },
  teamName: {
    fontFamily: fonts.heading,
    fontSize: fontSize.lg,
    color: colors.text.primary,
  },
  teamCount: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  jerseyBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.green.dim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jerseyNumber: {
    fontFamily: fonts.stats,
    fontSize: fontSize.md,
    color: colors.green.primary,
  },
  playerInfo: { flex: 1 },
  playerName: {
    fontFamily: fonts.heading,
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
  playerPos: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.text.muted,
    textTransform: 'capitalize',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
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

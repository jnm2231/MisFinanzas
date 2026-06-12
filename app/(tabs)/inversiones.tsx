import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SelectModal } from '@/components/select-modal';
import { Colors } from '@/constants/theme';
import { type Account, type Investment, type InvestmentType } from '@/db/database';
import {
  addContribution,
  createInvestment,
  deleteInvestment,
  getAccounts,
  getInvestments,
  refreshQuotes,
  updateInvestment,
} from '@/db/queries';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCurrency, formatDateTime, formatPercent, parseAmount } from '@/lib/format';

const TYPE_SECTIONS: { type: InvestmentType; label: string }[] = [
  { type: 'fondo', label: 'Fondos' },
  { type: 'etf', label: 'ETFs' },
  { type: 'accion', label: 'Acciones' },
];

const TYPE_OPTIONS = [
  { id: 'fondo', label: 'Fondo Indexado' },
  { id: 'etf', label: 'ETF' },
  { id: 'accion', label: 'Acción' },
];

export default function InversionesScreen() {
  const db = useSQLiteContext();
  const palette = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // Inversiones cuya última consulta de cotización falló: se señalan en amarillo.
  const [quoteErrors, setQuoteErrors] = useState<Set<number>>(new Set());
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const refreshedOnFocus = useRef(false);

  // Modal de edición integral (lápiz)
  const [editTarget, setEditTarget] = useState<Investment | null>(null);
  const [editName, setEditName] = useState('');
  const [editSymbol, setEditSymbol] = useState('');
  const [editPlatformId, setEditPlatformId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // Modal nueva inversión / aportación
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'nueva' | 'aportacion'>('nueva');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<InvestmentType | null>(null);
  const [formPlatformId, setFormPlatformId] = useState<number | null>(null);
  const [formSymbol, setFormSymbol] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formInvestmentId, setFormInvestmentId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setInvestments(await getInvestments(db));
    setAccounts(await getAccounts(db));
  }, [db]);

  const runRefresh = useCallback(async () => {
    setRefreshing(true);
    const result = await refreshQuotes(db);
    setQuoteErrors(new Set(result.failedIds));
    setRefreshing(false);
    await load();
  }, [db, load]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        await load();
        // Actualización automática de cotizaciones, una vez por visita a la pestaña.
        if (!refreshedOnFocus.current) {
          refreshedOnFocus.current = true;
          await runRefresh();
        }
      })();
      return () => {
        refreshedOnFocus.current = false;
      };
    }, [load, runRefresh])
  );

  const handleManualRefresh = async () => {
    const withSymbol = investments.filter((i) => i.symbol);
    if (withSymbol.length === 0) {
      setRefreshNote('No hay inversiones con símbolo de cotización.');
      setTimeout(() => setRefreshNote(null), 4000);
      return;
    }
    setRefreshNote(null);
    await runRefresh();
  };

  const openEditModal = (inv: Investment) => {
    setEditTarget(inv);
    setEditName(inv.name);
    setEditSymbol(inv.symbol ?? '');
    setEditPlatformId(inv.platform_account_id);
    setEditValue(inv.current_value.toFixed(2).replace('.', ','));
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    const value = parseAmount(editValue);
    if (value === null) {
      Alert.alert('Valor no válido', 'Introduce una cantidad mayor que 0.');
      return;
    }
    if (!editName.trim()) {
      Alert.alert('Falta el nombre', 'El nombre no puede estar vacío.');
      return;
    }
    if (editPlatformId === null) return;

    setSaving(true);
    const result = await updateInvestment(db, editTarget.id, {
      name: editName,
      symbol: editSymbol.trim() ? editSymbol : null,
      platformAccountId: editPlatformId,
      currentValue: value,
    });
    setSaving(false);
    if (!result.ok) {
      Alert.alert('No se puede guardar', result.reason);
      return;
    }
    setEditTarget(null);
    await load();
  };

  const handleDelete = (inv: Investment) => {
    Alert.alert(
      'Eliminar inversión',
      `¿Qué hacer con "${inv.name}" (valor ${formatCurrency(inv.current_value)})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Vender (devolver a la cuenta)',
          onPress: async () => {
            await deleteInvestment(db, inv.id, true);
            await load();
          },
        },
        {
          text: 'Eliminar sin devolver',
          style: 'destructive',
          onPress: async () => {
            await deleteInvestment(db, inv.id, false);
            await load();
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormMode('nueva');
    setFormName('');
    setFormType(null);
    setFormPlatformId(null);
    setFormSymbol('');
    setFormAmount('');
    setFormInvestmentId(null);
  };

  const handleSaveForm = async () => {
    const amount = parseAmount(formAmount);
    if (amount === null) {
      Alert.alert('Cantidad no válida', 'Introduce una cantidad mayor que 0.');
      return;
    }

    if (formMode === 'aportacion') {
      if (formInvestmentId === null) {
        Alert.alert('Falta la inversión', 'Selecciona la inversión existente a la que aportar.');
        return;
      }
      setSaving(true);
      const result = await addContribution(db, formInvestmentId, amount);
      setSaving(false);
      if (!result.ok) {
        Alert.alert('No se puede aportar', result.reason);
        return;
      }
    } else {
      if (!formName.trim()) {
        Alert.alert('Falta el nombre', 'Escribe un nombre para la inversión (ej: S&P 500).');
        return;
      }
      if (formType === null) {
        Alert.alert('Falta el tipo', 'Selecciona Fondo, ETF o Acción.');
        return;
      }
      if (formPlatformId === null) {
        Alert.alert('Falta la plataforma', 'Selecciona la cuenta desde la que inviertes.');
        return;
      }
      setSaving(true);
      const result = await createInvestment(db, {
        name: formName,
        type: formType,
        platformAccountId: formPlatformId,
        symbol: formSymbol.trim() ? formSymbol : null,
        amount,
      });
      setSaving(false);
      if (!result.ok) {
        Alert.alert('No se puede crear', result.reason);
        return;
      }
    }
    setFormVisible(false);
    resetForm();
    await load();
  };

  const renderInvestment = (inv: Investment) => {
    const profit = inv.current_value - inv.invested;
    const profitPct = inv.invested > 0 ? (profit / inv.invested) * 100 : 0;
    const profitColor = profit >= 0 ? palette.success : palette.danger;
    const quoteFailed = inv.symbol !== null && quoteErrors.has(inv.id);

    return (
      <Pressable
        key={inv.id}
        onLongPress={() => handleDelete(inv)}
        style={[styles.invRow, { borderBottomColor: palette.border }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.invName, { color: palette.text }]}>{inv.name}</Text>
          <Text style={[styles.invMeta, { color: palette.muted }]}>
            {inv.platform_name}
            {inv.symbol ? ` · ${inv.symbol}` : ' · valor manual'}
          </Text>
          <Text style={[styles.invMeta, { color: palette.muted }]}>
            Aportado: {formatCurrency(inv.invested)}
            {inv.last_updated ? ` · Act: ${formatDateTime(inv.last_updated)}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={[styles.invValue, { color: palette.text }]}>
            {formatCurrency(inv.current_value)}
          </Text>
          {quoteFailed ? (
            <View style={styles.apiErrorRow}>
              <MaterialCommunityIcons name="alert" size={13} color={palette.warning} />
              <Text style={[styles.apiErrorText, { color: palette.warning }]}>
                API no disponible
              </Text>
            </View>
          ) : (
            <Text style={[styles.invProfit, { color: profitColor }]}>
              {profit >= 0 ? '+' : ''}
              {formatCurrency(profit)} ({formatPercent(profitPct)})
            </Text>
          )}
        </View>
        <Pressable hitSlop={8} onPress={() => openEditModal(inv)} style={styles.editButton}>
          <MaterialCommunityIcons name="pencil" size={18} color={palette.tint} />
        </Pressable>
      </Pressable>
    );
  };

  const investmentOptions = investments.map((i) => ({
    id: i.id,
    label: i.name,
    sublabel: `${i.platform_name} · ${formatCurrency(i.current_value)}`,
  }));
  const accountOptions = accounts.map((a) => ({
    id: a.id,
    label: a.name,
    sublabel: formatCurrency(a.balance),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: palette.text }]}>Inversiones</Text>
          <Pressable
            style={[styles.refreshButton, { borderColor: palette.tint }]}
            onPress={handleManualRefresh}
            disabled={refreshing}>
            {refreshing ? (
              <ActivityIndicator size="small" color={palette.tint} />
            ) : (
              <MaterialCommunityIcons name="refresh" size={18} color={palette.tint} />
            )}
            <Text style={[styles.refreshText, { color: palette.tint }]}>Cotizaciones</Text>
          </Pressable>
        </View>

        {refreshNote && (
          <View style={styles.apiErrorRow}>
            <MaterialCommunityIcons name="alert" size={15} color={palette.warning} />
            <Text style={[styles.refreshNote, { color: palette.warning }]}>{refreshNote}</Text>
          </View>
        )}
        {quoteErrors.size > 0 && !refreshing && (
          <View style={styles.apiErrorRow}>
            <MaterialCommunityIcons name="wifi-off" size={15} color={palette.warning} />
            <Text style={[styles.refreshNote, { color: palette.warning }]}>
              {quoteErrors.size === 1
                ? 'Una cotización no está disponible. Se muestra el último valor conocido.'
                : `${quoteErrors.size} cotizaciones no están disponibles. Se muestran los últimos valores conocidos.`}
            </Text>
          </View>
        )}

        {TYPE_SECTIONS.map(({ type, label }) => {
          const items = investments.filter((i) => i.type === type);
          const sectionTotal = items.reduce((sum, i) => sum + i.current_value, 0);
          return (
            <View
              key={type}
              style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>{label}</Text>
                <Text style={[styles.sectionTotal, { color: palette.muted }]}>
                  {formatCurrency(sectionTotal)}
                </Text>
              </View>
              {items.length === 0 ? (
                <Text style={[styles.emptyText, { color: palette.muted }]}>
                  Sin {label.toLowerCase()} todavía
                </Text>
              ) : (
                items.map(renderInvestment)
              )}
            </View>
          );
        })}

        <Text style={[styles.hint, { color: palette.muted }]}>
          Lápiz: editar nombre, símbolo, plataforma o valor. Pulsación larga: vender o eliminar.
        </Text>

        <Pressable
          style={[styles.newButton, { backgroundColor: palette.tint }]}
          onPress={() => {
            resetForm();
            setFormVisible(true);
          }}>
          <MaterialCommunityIcons name="plus" size={20} color={palette.background} />
          <Text style={[styles.newButtonText, { color: palette.background }]}>Nueva Inversión</Text>
        </Pressable>
      </ScrollView>

      {/* Modal edición integral */}
      <Modal
        visible={editTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditTarget(null)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
            keyboardShouldPersistTaps="handled">
            <View
              style={[styles.modalCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Editar inversión</Text>

              <Text style={[styles.fieldLabel, { color: palette.muted }]}>Nombre</Text>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: palette.border, color: palette.text, backgroundColor: palette.card },
                ]}
                value={editName}
                onChangeText={setEditName}
              />

              <Text style={[styles.fieldLabel, { color: palette.muted }]}>
                Símbolo / ticker (vacío = valor manual)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: palette.border, color: palette.text, backgroundColor: palette.card },
                ]}
                placeholder="Ej: VWCE.DE"
                placeholderTextColor={palette.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                value={editSymbol}
                onChangeText={setEditSymbol}
              />

              <Text style={[styles.fieldLabel, { color: palette.muted }]}>Plataforma</Text>
              <SelectModal
                placeholder="Cuenta plataforma"
                options={accountOptions}
                selectedId={editPlatformId}
                onSelect={(id) => setEditPlatformId(Number(id))}
              />
              {editTarget && editPlatformId !== editTarget.platform_account_id && (
                <Text style={[styles.symbolHint, { color: palette.warning }]}>
                  Al cambiar la plataforma, el capital aportado (
                  {formatCurrency(editTarget.invested)}) se devolverá a la cuenta antigua y se
                  descontará de la nueva, que debe tener saldo suficiente.
                </Text>
              )}

              <Text style={[styles.fieldLabel, { color: palette.muted }]}>Valor actual</Text>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: palette.border, color: palette.text, backgroundColor: palette.card },
                ]}
                keyboardType="decimal-pad"
                value={editValue}
                onChangeText={setEditValue}
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.button, styles.modalButton, { backgroundColor: palette.card }]}
                  onPress={() => setEditTarget(null)}>
                  <Text style={[styles.buttonText, { color: palette.text }]}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.modalButton, { backgroundColor: palette.tint }]}
                  onPress={handleSaveEdit}
                  disabled={saving}>
                  {saving ? (
                    <ActivityIndicator size="small" color={palette.background} />
                  ) : (
                    <Text style={[styles.buttonText, { color: palette.background }]}>Guardar</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal nueva inversión / aportación */}
      <Modal
        visible={formVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFormVisible(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
            keyboardShouldPersistTaps="handled">
            <View
              style={[styles.modalCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Nueva Inversión</Text>

              {/* Selector modo */}
              <View
                style={[styles.segment, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Pressable
                  style={[styles.segmentItem, formMode === 'nueva' && { backgroundColor: palette.tint }]}
                  onPress={() => setFormMode('nueva')}>
                  <Text
                    style={[
                      styles.segmentText,
                      { color: formMode === 'nueva' ? palette.background : palette.text },
                    ]}>
                    Nuevo activo
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.segmentItem,
                    formMode === 'aportacion' && { backgroundColor: palette.tint },
                  ]}
                  onPress={() => setFormMode('aportacion')}>
                  <Text
                    style={[
                      styles.segmentText,
                      { color: formMode === 'aportacion' ? palette.background : palette.text },
                    ]}>
                    Aportación
                  </Text>
                </Pressable>
              </View>

              {formMode === 'nueva' ? (
                <>
                  <Text style={[styles.fieldLabel, { color: palette.muted }]}>Nombre</Text>
                  <TextInput
                    style={[
                      styles.input,
                      { borderColor: palette.border, color: palette.text, backgroundColor: palette.card },
                    ]}
                    placeholder="Ej: S&P 500"
                    placeholderTextColor={palette.muted}
                    value={formName}
                    onChangeText={setFormName}
                  />
                  <Text style={[styles.fieldLabel, { color: palette.muted }]}>Tipo</Text>
                  <SelectModal
                    placeholder="Fondo, ETF o Acción"
                    options={TYPE_OPTIONS}
                    selectedId={formType}
                    onSelect={(id) => setFormType(id as InvestmentType)}
                  />
                  <Text style={[styles.fieldLabel, { color: palette.muted }]}>
                    Plataforma (cuenta de origen)
                  </Text>
                  <SelectModal
                    placeholder="Selecciona la cuenta"
                    options={accountOptions}
                    selectedId={formPlatformId}
                    onSelect={(id) => setFormPlatformId(Number(id))}
                  />
                  <Text style={[styles.fieldLabel, { color: palette.muted }]}>
                    Símbolo / ticker (opcional)
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { borderColor: palette.border, color: palette.text, backgroundColor: palette.card },
                    ]}
                    placeholder="Ej: VWCE.DE, AAPL, SAN.MC"
                    placeholderTextColor={palette.muted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    value={formSymbol}
                    onChangeText={setFormSymbol}
                  />
                  <Text style={[styles.symbolHint, { color: palette.muted }]}>
                    Con símbolo, el valor se actualiza solo con la cotización (Yahoo Finance). Usa
                    el ticker en EUR (.DE, .MC, .AS...). Sin símbolo, el valor se ajusta a mano.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.fieldLabel, { color: palette.muted }]}>
                    Inversión existente
                  </Text>
                  <SelectModal
                    placeholder="Selecciona la inversión"
                    options={investmentOptions}
                    selectedId={formInvestmentId}
                    onSelect={(id) => setFormInvestmentId(Number(id))}
                  />
                </>
              )}

              <Text style={[styles.fieldLabel, { color: palette.muted }]}>Cantidad a invertir</Text>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: palette.border, color: palette.text, backgroundColor: palette.card },
                ]}
                placeholder="0,00 €"
                placeholderTextColor={palette.muted}
                keyboardType="decimal-pad"
                value={formAmount}
                onChangeText={setFormAmount}
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.button, styles.modalButton, { backgroundColor: palette.card }]}
                  onPress={() => setFormVisible(false)}>
                  <Text style={[styles.buttonText, { color: palette.text }]}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.modalButton, { backgroundColor: palette.tint }]}
                  onPress={handleSaveForm}
                  disabled={saving}>
                  {saving ? (
                    <ActivityIndicator size="small" color={palette.background} />
                  ) : (
                    <Text style={[styles.buttonText, { color: palette.background }]}>Guardar</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '600',
  },
  refreshNote: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionTotal: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    paddingVertical: 6,
  },
  invRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  invName: {
    fontSize: 15,
    fontWeight: '600',
  },
  invMeta: {
    fontSize: 12,
  },
  invValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  invProfit: {
    fontSize: 12,
    fontWeight: '600',
  },
  apiErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  apiErrorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editButton: {
    padding: 4,
  },
  hint: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 14,
  },
  newButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    marginBottom: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  symbolHint: {
    fontSize: 12,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalButton: {
    flex: 1,
  },
});

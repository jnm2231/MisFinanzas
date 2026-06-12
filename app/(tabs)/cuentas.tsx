import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
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
import { type Account } from '@/db/database';
import {
  createAccount,
  deleteAccount,
  getAccounts,
  getBaseAccountId,
  transferBetweenAccounts,
} from '@/db/queries';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCurrency, parseAmount } from '@/lib/format';

export default function CuentasScreen() {
  const db = useSQLiteContext();
  const palette = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [baseAccountId, setBaseAccountId] = useState<number | null>(null);

  // Transferencia
  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [transferAmount, setTransferAmount] = useState('');

  // Nueva cuenta
  const [newAccountVisible, setNewAccountVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('');

  const load = useCallback(async () => {
    setAccounts(await getAccounts(db));
    setBaseAccountId(await getBaseAccountId(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const accountOptions = accounts.map((a) => ({
    id: a.id,
    label: a.name,
    sublabel: formatCurrency(a.balance),
  }));

  const handleTransfer = async () => {
    const amount = parseAmount(transferAmount);
    if (fromId === null || toId === null) {
      Alert.alert('Faltan cuentas', 'Selecciona la cuenta de origen y la de destino.');
      return;
    }
    if (fromId === toId) {
      Alert.alert('Cuentas iguales', 'La cuenta de origen y destino deben ser distintas.');
      return;
    }
    if (amount === null) {
      Alert.alert('Cantidad no válida', 'Introduce una cantidad mayor que 0.');
      return;
    }
    await transferBetweenAccounts(db, fromId, toId, amount);
    setTransferAmount('');
    await load();
    Alert.alert('Transferencia realizada', `Se han movido ${formatCurrency(amount)}.`);
  };

  const handleCreateAccount = async () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Falta el nombre', 'Escribe un nombre para la cuenta.');
      return;
    }
    const balance = newBalance.trim() ? parseAmount(newBalance) : 0;
    if (balance === null) {
      Alert.alert('Saldo no válido', 'El saldo inicial debe ser un número mayor o igual que 0.');
      return;
    }
    try {
      await createAccount(db, name, balance);
    } catch {
      Alert.alert('Cuenta duplicada', 'Ya existe una cuenta con ese nombre.');
      return;
    }
    setNewName('');
    setNewBalance('');
    setNewAccountVisible(false);
    await load();
  };

  const handleDeleteAccount = (account: Account) => {
    Alert.alert('Eliminar cuenta', `¿Eliminar "${account.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const result = await deleteAccount(db, account.id);
          if (!result.ok) {
            Alert.alert('No se puede eliminar', result.reason);
            return;
          }
          await load();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: palette.text }]}>Cuentas</Text>

        {/* Listado de cuentas */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {accounts.map((account, index) => (
            <Pressable
              key={account.id}
              onLongPress={() => handleDeleteAccount(account)}
              style={[
                styles.accountRow,
                index < accounts.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: palette.border,
                },
              ]}>
              <MaterialCommunityIcons name="bank-outline" size={22} color={palette.muted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.accountName, { color: palette.text }]}>{account.name}</Text>
                {account.id === baseAccountId && (
                  <Text style={[styles.baseBadge, { color: palette.tint }]}>Cuenta Base</Text>
                )}
              </View>
              <Text
                style={[
                  styles.accountBalance,
                  { color: account.balance < 0 ? palette.danger : palette.text },
                ]}>
                {formatCurrency(account.balance)}
              </Text>
            </Pressable>
          ))}
          <Text style={[styles.hint, { color: palette.muted }]}>
            Mantén pulsada una cuenta para eliminarla.
          </Text>
        </View>

        {/* Transferencia interna */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="swap-horizontal" size={22} color={palette.tint} />
            <Text style={[styles.cardTitle, { color: palette.text }]}>Transferencia interna</Text>
          </View>
          <Text style={[styles.fieldLabel, { color: palette.muted }]}>Desde</Text>
          <SelectModal
            placeholder="Cuenta de origen"
            options={accountOptions}
            selectedId={fromId}
            onSelect={(id) => setFromId(Number(id))}
          />
          <Text style={[styles.fieldLabel, { color: palette.muted }]}>Hacia</Text>
          <SelectModal
            placeholder="Cuenta de destino"
            options={accountOptions}
            selectedId={toId}
            onSelect={(id) => setToId(Number(id))}
          />
          <Text style={[styles.fieldLabel, { color: palette.muted }]}>Cantidad</Text>
          <TextInput
            style={[
              styles.input,
              { borderColor: palette.border, color: palette.text, backgroundColor: palette.background },
            ]}
            placeholder="0,00 €"
            placeholderTextColor={palette.muted}
            keyboardType="decimal-pad"
            value={transferAmount}
            onChangeText={setTransferAmount}
          />
          <Pressable
            style={[styles.button, { backgroundColor: palette.tint }]}
            onPress={handleTransfer}>
            <Text style={[styles.buttonText, { color: palette.background }]}>Transferir</Text>
          </Pressable>
        </View>

        {/* Nueva cuenta */}
        <Pressable
          style={[styles.newAccountButton, { borderColor: palette.tint }]}
          onPress={() => setNewAccountVisible(true)}>
          <MaterialCommunityIcons name="plus" size={20} color={palette.tint} />
          <Text style={[styles.newAccountText, { color: palette.tint }]}>
            Nueva Cuenta de Banco
          </Text>
        </Pressable>
      </ScrollView>

      {/* Modal nueva cuenta */}
      <Modal
        visible={newAccountVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNewAccountVisible(false)}>
        <View style={styles.backdrop}>
          <View
            style={[styles.modalCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Nueva Cuenta de Banco</Text>
            <Text style={[styles.fieldLabel, { color: palette.muted }]}>Nombre</Text>
            <TextInput
              style={[
                styles.input,
                { borderColor: palette.border, color: palette.text, backgroundColor: palette.card },
              ]}
              placeholder="Ej: Santander"
              placeholderTextColor={palette.muted}
              value={newName}
              onChangeText={setNewName}
            />
            <Text style={[styles.fieldLabel, { color: palette.muted }]}>Saldo inicial</Text>
            <TextInput
              style={[
                styles.input,
                { borderColor: palette.border, color: palette.text, backgroundColor: palette.card },
              ]}
              placeholder="0,00 €"
              placeholderTextColor={palette.muted}
              keyboardType="decimal-pad"
              value={newBalance}
              onChangeText={setNewBalance}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.button, styles.modalButton, { backgroundColor: palette.card }]}
                onPress={() => setNewAccountVisible(false)}>
                <Text style={[styles.buttonText, { color: palette.text }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.modalButton, { backgroundColor: palette.tint }]}
                onPress={handleCreateAccount}>
                <Text style={[styles.buttonText, { color: palette.background }]}>Crear</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
  },
  baseBadge: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  accountBalance: {
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 17,
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
  newAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
  },
  newAccountText: {
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
    gap: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
  },
});

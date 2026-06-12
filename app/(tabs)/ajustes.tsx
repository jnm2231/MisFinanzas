import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { resetDatabase, type Account, type Category, type CategoryType } from '@/db/database';
import {
  addCategory,
  deleteCategory,
  getAccounts,
  getBaseAccountId,
  getCategories,
  setBaseAccountId,
} from '@/db/queries';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCurrency } from '@/lib/format';

export default function AjustesScreen() {
  const db = useSQLiteContext();
  const palette = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [baseId, setBaseId] = useState<number | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newIncomeCategory, setNewIncomeCategory] = useState('');

  const load = useCallback(async () => {
    setAccounts(await getAccounts(db));
    setBaseId(await getBaseAccountId(db));
    setExpenseCategories(await getCategories(db, 'gasto'));
    setIncomeCategories(await getCategories(db, 'ingreso'));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleSetBase = async (accountId: number) => {
    await setBaseAccountId(db, accountId);
    setBaseId(accountId);
  };

  const handleAddCategory = async (type: CategoryType) => {
    const name = (type === 'gasto' ? newExpenseCategory : newIncomeCategory).trim();
    if (!name) return;
    await addCategory(db, name, type);
    if (type === 'gasto') {
      setNewExpenseCategory('');
    } else {
      setNewIncomeCategory('');
    }
    await load();
  };

  const handleDeleteCategory = (category: Category) => {
    Alert.alert(
      'Eliminar categoría',
      `¿Eliminar "${category.name}"? Los movimientos antiguos pasarán a "Sin categoría".`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteCategory(db, category.id);
            await load();
          },
        },
      ]
    );
  };

  const handleResetData = () => {
    Alert.alert(
      'Borrar todos los datos',
      'Se eliminarán todas las cuentas, movimientos e inversiones. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todo',
          style: 'destructive',
          onPress: async () => {
            await resetDatabase(db);
            await load();
          },
        },
      ]
    );
  };

  const renderCategoryManager = (
    title: string,
    categories: Category[],
    type: CategoryType,
    inputValue: string,
    onChangeInput: (text: string) => void
  ) => (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text style={[styles.cardTitle, { color: palette.text }]}>{title}</Text>
      <View style={styles.chips}>
        {categories.map((category) => (
          <View
            key={category.id}
            style={[styles.chip, { borderColor: palette.border, backgroundColor: palette.background }]}>
            <Text style={[styles.chipText, { color: palette.text }]}>{category.name}</Text>
            <Pressable hitSlop={6} onPress={() => handleDeleteCategory(category)}>
              <MaterialCommunityIcons name="close" size={16} color={palette.muted} />
            </Pressable>
          </View>
        ))}
        {categories.length === 0 && (
          <Text style={{ color: palette.muted }}>No hay ninguna todavía.</Text>
        )}
      </View>
      <View style={styles.addRow}>
        <TextInput
          style={[
            styles.input,
            { borderColor: palette.border, color: palette.text, backgroundColor: palette.background, flex: 1 },
          ]}
          placeholder="Nueva categoría..."
          placeholderTextColor={palette.muted}
          value={inputValue}
          onChangeText={onChangeInput}
          onSubmitEditing={() => handleAddCategory(type)}
          returnKeyType="done"
        />
        <Pressable
          style={[styles.addButton, { backgroundColor: palette.tint }]}
          onPress={() => handleAddCategory(type)}>
          <MaterialCommunityIcons name="plus" size={22} color={palette.background} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: palette.text }]}>Ajustes</Text>

        {/* Cuenta Base */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Cuenta Base</Text>
          <Text style={[styles.cardSubtitle, { color: palette.muted }]}>
            Los gastos e ingresos rápidos de la pestaña Agregar se aplican a esta cuenta.
          </Text>
          {accounts.map((account) => {
            const selected = account.id === baseId;
            return (
              <Pressable
                key={account.id}
                style={[styles.radioRow, { borderBottomColor: palette.border }]}
                onPress={() => handleSetBase(account.id)}>
                <MaterialCommunityIcons
                  name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                  size={22}
                  color={selected ? palette.tint : palette.muted}
                />
                <Text style={[styles.radioLabel, { color: palette.text }]}>{account.name}</Text>
                <Text style={[styles.radioBalance, { color: palette.muted }]}>
                  {formatCurrency(account.balance)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {renderCategoryManager(
          'Categorías de gasto',
          expenseCategories,
          'gasto',
          newExpenseCategory,
          setNewExpenseCategory
        )}

        {renderCategoryManager(
          'Tipos de ingreso',
          incomeCategories,
          'ingreso',
          newIncomeCategory,
          setNewIncomeCategory
        )}

        {/* Zona peligrosa */}
        <View style={[styles.card, { borderColor: palette.danger, backgroundColor: palette.card }]}>
          <Text style={[styles.cardTitle, { color: palette.danger }]}>Zona peligrosa</Text>
          <Pressable
            style={[styles.dangerButton, { borderColor: palette.danger }]}
            onPress={handleResetData}>
            <MaterialCommunityIcons name="delete-forever" size={20} color={palette.danger} />
            <Text style={[styles.dangerText, { color: palette.danger }]}>
              Borrar todos los datos
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.version, { color: palette.muted }]}>
          Mis Finanzas · datos guardados solo en este dispositivo
        </Text>
      </ScrollView>
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
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 13,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  radioBalance: {
    fontSize: 14,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 14,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  addButton: {
    borderRadius: 10,
    padding: 10,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
  },
  dangerText: {
    fontSize: 15,
    fontWeight: '700',
  },
  version: {
    fontSize: 12,
    textAlign: 'center',
  },
});

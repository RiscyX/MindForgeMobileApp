import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';

export default function TopRightMenu() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { isAuthenticated, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const activeRouteName = useNavigationState((navState) => navState?.routes?.[navState.index]?.name);

  if (!isAuthenticated) {
    return null;
  }

  const roleId = Number(user?.role_id);
  const canManageTests = roleId === 1 || roleId === 2;

  const items = [
    { key: 'Home', label: t('nav.tests') },
    { key: 'Practice', label: t('nav.practice') },
    { key: 'Stats', label: t('nav.stats') },
    { key: 'Favorites', label: t('nav.favorites') },
    { key: 'Profile', label: t('nav.profile') },
    ...(canManageTests ? [{ key: 'ManageTests', label: t('nav.manageTests') }] : []),
  ];

  return (
    <>
      <View pointerEvents="box-none" style={styles.anchor}>
        <Pressable
          onPress={() => setIsOpen(true)}
          style={[styles.button, { top: insets.top + 8 }]}
        >
          <View style={styles.bar} />
          <View style={styles.bar} />
          <View style={styles.bar} />
        </Pressable>
      </View>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={[styles.menu, { top: insets.top + 56 }]} onPress={() => {}}>
            {items.map((item) => {
              const isActive = activeRouteName === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.item, isActive ? styles.itemActive : null]}
                  onPress={() => {
                    setIsOpen(false);
                    navigation.navigate(item.key);
                  }}
                >
                  <Text className={`font-solway-bold text-sm ${isActive ? 'text-mf-text' : 'text-mf-secondary'}`}>{item.label}</Text>
                </Pressable>
              );
            })}

            <Pressable style={styles.cancel} onPress={() => setIsOpen(false)}>
              <Text className="font-solway-bold text-sm text-mf-secondary">{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  anchor: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  button: {
    position: 'absolute',
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(234,233,252,0.25)',
    backgroundColor: 'rgba(1,1,4,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bar: {
    width: 16,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#eae9fc',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(1,1,4,0.45)',
  },
  menu: {
    position: 'absolute',
    right: 16,
    width: 180,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(234,233,252,0.12)',
    backgroundColor: 'rgba(8,8,20,0.98)',
    padding: 8,
  },
  item: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(234,233,252,0.14)',
    backgroundColor: 'rgba(234,233,252,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  itemActive: {
    borderColor: 'rgba(87,93,219,0.65)',
    backgroundColor: 'rgba(87,93,219,0.28)',
  },
  cancel: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(234,233,252,0.2)',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});

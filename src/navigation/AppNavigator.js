import { useCallback } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { TestActionsProvider } from '../context/TestActionsContext';
import CustomTabBar from './CustomTabBar';
import TopRightMenu from './TopRightMenu';

import HomeScreen from '../screens/HomeScreen';
import StatsScreen from '../screens/StatsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import PracticeSelectScreen from '../screens/PracticeSelectScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import TestDetailsScreen from '../screens/TestDetailsScreen';
import TestScreen from '../screens/TestScreen';
import CreateTestScreen from '../screens/CreateTestScreen';
import ManageTestsScreen from '../screens/ManageTestsScreen';
import EditTestScreen from '../screens/EditTestScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const SCREEN_OPTIONS = { headerShown: false, contentStyle: { backgroundColor: 'transparent' } };
const MODAL_OPTIONS = { ...SCREEN_OPTIONS, presentation: 'modal', animation: 'slide_from_bottom' };

function withTopRightMenu(ScreenComponent) {
  return function ScreenWithTopRightMenu(props) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenComponent {...props} />
        <TopRightMenu />
      </View>
    );
  };
}

const HomeScreenWithMenu = withTopRightMenu(HomeScreen);
const PracticeScreenWithMenu = withTopRightMenu(PracticeSelectScreen);
const StatsScreenWithMenu = withTopRightMenu(StatsScreen);
const ProfileScreenWithMenu = withTopRightMenu(ProfileScreen);
const FavoritesScreenWithMenu = withTopRightMenu(FavoritesScreen);

// All tabs always registered; custom tab bar handles auth-gated visibility.
function MainTabs() {
  const renderTabBar = useCallback((props) => <CustomTabBar {...props} />, []);

  return (
    <Tab.Navigator
      tabBar={renderTabBar}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreenWithMenu} />
      <Tab.Screen name="Practice" component={PracticeScreenWithMenu} />
      <Tab.Screen name="Stats" component={StatsScreenWithMenu} />
      <Tab.Screen name="Profile" component={ProfileScreenWithMenu} />
      <Tab.Screen name="Favorites" component={FavoritesScreenWithMenu} />
    </Tab.Navigator>
  );
}

function AppStack() {
  const { isBootstrapping } = useAuth();
  const { isLanguageReady } = useLanguage();

  if (isBootstrapping || !isLanguageReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#010104' }}>
        <ActivityIndicator size="large" color="#575ddb" />
      </View>
    );
  }

  return (
    <TestActionsProvider>
      <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="Login" component={LoginScreen} options={MODAL_OPTIONS} />
        <Stack.Screen name="Register" component={RegisterScreen} options={MODAL_OPTIONS} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={MODAL_OPTIONS} />
        <Stack.Screen name="TestDetails" component={TestDetailsScreen} />
        <Stack.Screen name="Test" component={TestScreen} />
        <Stack.Screen name="CreateTest" component={CreateTestScreen} />
        <Stack.Screen name="ManageTests" component={ManageTestsScreen} options={MODAL_OPTIONS} />
        <Stack.Screen name="EditTest" component={EditTestScreen} />
      </Stack.Navigator>
    </TestActionsProvider>
  );
}

const NAV_THEME = {
  dark: true,
  colors: {
    primary: '#575ddb',
    background: 'transparent',
    card: '#010104',
    text: '#eae9fc',
    border: 'rgba(91,91,107,0.3)',
    notification: '#575ddb',
  },
  fonts: {
    regular: { fontFamily: 'Solway_400Regular', fontWeight: '400' },
    medium: { fontFamily: 'Solway_500Medium', fontWeight: '500' },
    bold: { fontFamily: 'Solway_700Bold', fontWeight: '700' },
  },
};

export default function AppNavigator() {
  return (
    <NavigationContainer theme={NAV_THEME}>
      <AppStack />
    </NavigationContainer>
  );
}

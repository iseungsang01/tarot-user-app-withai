import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { LocalSvg } from 'react-native-svg/css';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { DrawerTheme } from '../constants/DrawerTheme';
import { useNotifications } from '../hooks/useNotifications';
import { CoachMarksOverlay } from '../components';
import { useUI } from '../context/UIContext';

import {
  HistoryScreen,
  SettingsScreen,
  ForcedPasswordChangeScreen,
  VisitDetailScreen,
  DailyFortuneScreen,
  DailyFortuneDrawScreen,
  NoticeDetailScreen,
  NewsScreen,
  TicketScreen,
  BugReportScreen,
  BugReportDetailScreen,
  PasswordResetScreen,
  DeleteAccountScreen,
} from '../screens';
import { useAuth } from '../hooks/useAuth';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const COACH_STEPS = [
  { key: 'tab-home', title: '1) 서랍으로 이동', description: '하단의 서랍 탭을 눌러 기록 화면으로 이동해 주세요.', requireTargetTap: true },
  { key: 'home-stamp', title: '2) 스탬프 확인', description: '상단 요약의 스탬프 영역을 눌러 스탬프 화면으로 들어가 보세요.', requireTargetTap: true },
  { key: 'home-archive-mode', title: '3) ALL · ON · OFF 필터', description: 'ALL/ON/OFF 버튼을 눌러 기록 유형을 전환해 보세요.', requireTargetTap: true },
  { key: 'home-time-filter', title: '4) 전체 · 연도별 · 월별', description: '기간 필터를 눌러 원하는 시점의 기록만 빠르게 찾아보세요.', requireTargetTap: true },
  { key: 'tab-notice', title: '5) 소식 확인', description: '하단 소식 탭에서 최신 공지와 알림을 확인하세요.', requireTargetTap: true },
  { key: 'tab-settings', title: '6) 설정 확인', description: '하단 설정 탭에서 계정과 앱 설정을 확인하세요.', requireTargetTap: true },
  { key: 'tab-home', title: '7) 가이드 종료', description: '다시 서랍으로 돌아오면 가이드가 완료됩니다.', requireTargetTap: true },
];

const STEP_ROUTE_MAP = {
  'tab-home': 'Home',
  'home-stamp': 'Home',
  'home-archive-mode': 'Home',
  'home-time-filter': 'Home',
  'tab-notice': 'News',
  'tab-settings': 'Settings',
};

const TARGET_TAP_ADVANCE_KEYS = new Set(['tab-home', 'tab-notice', 'tab-settings']);

const TAB_ICONS = {
  archive: require('../../assets/tarot-cellar/icon-archive.svg'),
  ticket: require('../../assets/tarot-cellar/icon-ticket.svg'),
  ritual: require('../../assets/tarot-cellar/icon-ritual.svg'),
  notice: require('../../assets/tarot-cellar/icon-notice.svg'),
  tune: require('../../assets/tarot-cellar/icon-tune.svg'),
};

const TabIcon = ({ source, focused, hasNotification }) => (
  <View style={styles.iconContainer}>
    <LocalSvg
      asset={source}
        width={20}
        height={20}
      style={[
        styles.iconImage,
        { opacity: focused ? 1 : 0.68 },
        focused && styles.iconImageActive,
      ]}
    />
    {hasNotification && <View style={styles.redDot} />}
  </View>
);

const CoachableTabButton = ({ onCaptureFrame, ...props }) => {
  const ref = useRef(null);

  const captureFrame = () => {
    if (!ref.current || !onCaptureFrame) return;

    ref.current.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) onCaptureFrame({ x, y, width, height });
    });
  };

  return <TouchableOpacity ref={ref} {...props} onLayout={captureFrame} onPressIn={captureFrame} />;
};

const tabIcon = (source, hasNotification = false) => ({ focused }) => (
  <TabIcon source={source} focused={focused} hasNotification={hasNotification} />
);

const TabNavigator = () => {
  const { hasAnyUnread } = useNotifications();
  const insets = useSafeAreaInsets();
  const { showCoachMarks, coachMarksSessionId, completeCoachMarks } = useUI();
  const [stepIndex, setStepIndex] = useState(0);
  const [frames, setFrames] = useState({});
  const navRef = useRef(null);
  const tabRootRef = useRef(null);
  const [tabRootWindowOffset, setTabRootWindowOffset] = useState({ x: 0, y: 0 });
  const [isTabRootOffsetReady, setIsTabRootOffsetReady] = useState(false);
  const zeroFrameCountsRef = useRef({});

  const captureTabRootOffset = useCallback(() => {
    if (!tabRootRef.current) return;

    tabRootRef.current.measureInWindow((x, y) => {
      setTabRootWindowOffset({ x, y });
      setIsTabRootOffsetReady(true);
    });
  }, []);

  const registerFrame = (key, frame) => {
    if (!frame) return;

    if (!isTabRootOffsetReady) {
      return;
    }

    const isZeroFrame = frame.x === 0 && frame.y === 0;
    const nextZeroCount = isZeroFrame ? (zeroFrameCountsRef.current[key] || 0) + 1 : 0;
    zeroFrameCountsRef.current[key] = nextZeroCount;

    if (isZeroFrame && nextZeroCount >= 2) {
      console.warn(`[CoachMarks] Ignore repeated zero frame for "${key}"`, { frame, zeroCount: nextZeroCount });
      return;
    }

    const normalizedFrame = {
      ...frame,
      x: Math.max(0, frame.x - tabRootWindowOffset.x),
      y: Math.max(0, frame.y - tabRootWindowOffset.y),
    };

    setFrames((prev) => ({ ...prev, [key]: normalizedFrame }));
  };

  useEffect(() => {
    if (!showCoachMarks || !coachMarksSessionId) return;

    setStepIndex(0);
    setFrames({});
    zeroFrameCountsRef.current = {};

    requestAnimationFrame(() => {
      captureTabRootOffset();
    });
  }, [showCoachMarks, coachMarksSessionId, captureTabRootOffset]);

  const stepsWithFrame = useMemo(() => COACH_STEPS.map((step) => ({ ...step, frame: frames[step.key] })), [frames]);
  const currentStep = stepsWithFrame[stepIndex];
  const isCoachVisible = showCoachMarks && !!currentStep?.frame;

  useEffect(() => {
    if (!showCoachMarks) return;
    if (currentStep?.frame) return;

    const retryFrameCapture = requestAnimationFrame(() => {
      captureTabRootOffset();
    });

    const fallbackTimer = setTimeout(() => {
      if (!stepsWithFrame[stepIndex]?.frame) {
        console.warn('[CoachMarks] Missing step frame. Completing guide safely.', {
          stepIndex,
          stepKey: stepsWithFrame[stepIndex]?.key,
        });
        completeCoachMarks();
      }
    }, 300);

    return () => {
      cancelAnimationFrame(retryFrameCapture);
      clearTimeout(fallbackTimer);
    };
  }, [showCoachMarks, currentStep, stepIndex, stepsWithFrame, captureTabRootOffset, completeCoachMarks]);

  const finishCoach = () => {
    completeCoachMarks();
    setStepIndex(0);
  };

  const advanceStep = useCallback((expectedStepKey, options = {}) => {
    const { navigateNext = true } = options;
    const current = stepsWithFrame[stepIndex];
    if (!current) return;
    if (expectedStepKey && current.key !== expectedStepKey) return;

    if (stepIndex >= stepsWithFrame.length - 1) {
      finishCoach();
      return;
    }

    setStepIndex((prev) => {
      const nextIndex = Math.min(prev + 1, stepsWithFrame.length - 1);
      const nextStep = stepsWithFrame[nextIndex];
      const nextRouteName = STEP_ROUTE_MAP[nextStep?.key];
      if (navigateNext && nextRouteName) navRef.current?.navigate(nextRouteName);
      return nextIndex;
    });
  }, [stepIndex, stepsWithFrame]);

  const onCoachTargetPress = () => {
    const current = stepsWithFrame[stepIndex];
    if (!current) return;

    const routeName = STEP_ROUTE_MAP[current.key];
    if (routeName) navRef.current?.navigate(routeName);

    if (TARGET_TAP_ADVANCE_KEYS.has(current.key)) {
      advanceStep(current.key);
    }
  };

  return (
    <View
      ref={tabRootRef}
      style={styles.tabRoot}
      onLayout={() => {
        requestAnimationFrame(captureTabRootOffset);
      }}
    >
      <Tab.Navigator
        ref={navRef}
        screenOptions={{
          headerShown: false,
          unmountOnBlur: true,
          tabBarStyle: {
            backgroundColor: 'rgba(9,0,13,0.94)',
            borderTopColor: 'rgba(200,163,64,0.18)',
            borderTopWidth: StyleSheet.hairlineWidth,
            paddingBottom: insets.bottom,
            paddingTop: 4,
            height: 64 + insets.bottom,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.24,
            shadowRadius: 8,
            elevation: 8,
          },
          tabBarActiveTintColor: DrawerTheme.antiqueGold,
          tabBarInactiveTintColor: 'rgba(142,122,154,0.58)',
          tabBarLabelStyle: {
            fontSize: 9.5,
            fontWeight: '600',
            marginBottom: insets.bottom > 0 ? 0 : 3,
            letterSpacing: 0.2,
          },
          tabBarItemStyle: {
            minWidth: 0,
            paddingHorizontal: 0,
          },
        }}
        sceneContainerStyle={{ backgroundColor: DrawerTheme.bgBlackPurple }}
      >
        <Tab.Screen
          name="Home"
          options={{
            tabBarLabel: '서랍',
            tabBarIcon: tabIcon(TAB_ICONS.archive),
            tabBarButton: (props) => <CoachableTabButton {...props} onCaptureFrame={(frame) => registerFrame('tab-home', frame)} />,
          }}
        >
          {(props) => (
            <HistoryScreen
              {...props}
              onCaptureCoachFrame={registerFrame}
              currentCoachStepKey={stepsWithFrame[stepIndex]?.key}
              advanceCoachStep={advanceStep}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Ticket" component={TicketScreen} options={{ tabBarLabel: '쿠폰', tabBarIcon: tabIcon(TAB_ICONS.ticket) }} />
        <Tab.Screen
          name="DailyFortune"
          component={DailyFortuneScreen}
          options={{ tabBarLabel: '운세', tabBarIcon: tabIcon(TAB_ICONS.ritual) }}
        />
        <Tab.Screen
          name="News"
          component={NewsScreen}
          options={{
            tabBarLabel: '소식',
            tabBarIcon: tabIcon(TAB_ICONS.notice, hasAnyUnread),
            tabBarButton: (props) => <CoachableTabButton {...props} onCaptureFrame={(frame) => registerFrame('tab-notice', frame)} />,
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: '설정',
            tabBarIcon: tabIcon(TAB_ICONS.tune),
            tabBarButton: (props) => <CoachableTabButton {...props} onCaptureFrame={(frame) => registerFrame('tab-settings', frame)} />,
          }}
        />
      </Tab.Navigator>

      {isCoachVisible && (
        <CoachMarksOverlay
          steps={stepsWithFrame}
          stepIndex={stepIndex}
          onNext={onCoachTargetPress}
          onTargetPress={onCoachTargetPress}
          onClose={finishCoach}
        />
      )}
    </View>
  );
};

const MainNavigator = () => {
  const { customer } = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={customer?.must_change_password ? 'ForcedPasswordChange' : 'MainTabs'}
    >
      <Stack.Screen name="ForcedPasswordChange" component={ForcedPasswordChangeScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="DailyFortuneDraw" component={DailyFortuneDrawScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="VisitDetail" component={VisitDetailScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="NoticeDetail" component={NoticeDetailScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="BugReport" component={BugReportScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="BugReportDetail" component={BugReportDetailScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="PasswordReset" component={PasswordResetScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ presentation: 'card' }} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  tabRoot: { flex: 1 },
  iconContainer: {
    position: 'relative',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconImage: {
    width: 20,
    height: 20,
  },
  iconImageActive: {
    shadowColor: DrawerTheme.brassHighlight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 5,
  },
  redDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8A2D3B',
    borderWidth: 1,
    borderColor: Colors.purpleMid,
  },
});

export default MainNavigator;

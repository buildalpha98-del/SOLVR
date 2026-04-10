import React from "react";
import { View, ActivityIndicator, Image, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
import { colors, LOGO } from "../lib/theme";

export default function Index() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <ActivityIndicator
          color={colors.primary}
          size="large"
          style={styles.spinner}
        />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user && !user.onboardingCompleted) {
    return <Redirect href="/onboarding/step-0" />;
  }

  return <Redirect href="/(portal)/dashboard" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 180,
    height: 60,
  },
  spinner: {
    marginTop: 24,
  },
});

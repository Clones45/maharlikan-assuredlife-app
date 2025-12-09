import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { memorialColors } from "../../../constants/memorialTheme";

export default function PromotionsScreen() {
  const websiteURL = "https://www.maharlikanassuredlife.com";

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: websiteURL }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={memorialColors.primary} />
          </View>
        )}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: memorialColors.white,
  },
  webview: {
    flex: 1,
    marginTop: 0,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: memorialColors.primary,
  },
});

import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FeesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background px-4 py-6">
      <Text className="text-2xl font-bold text-foreground">Fees</Text>
      <Text className="mt-2 text-muted-foreground">Pay and receipts.</Text>
    </SafeAreaView>
  );
}

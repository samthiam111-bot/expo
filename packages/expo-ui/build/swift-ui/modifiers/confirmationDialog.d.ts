import React from 'react';
import { type ModifierConfig } from './createModifier';
/**
 * Presents a confirmation dialog when `isPresented` is true.
 *
 * The dialog renders native SwiftUI action buttons and an optional message view
 * passed as React elements via the `actions` and `message` parameters.
 *
 * @param params - Configuration for the confirmation dialog.
 * @returns A modifier config that can be passed in the `modifiers` prop array.
 *
 * @example
 * ```tsx
 * import { VStack, Button, Text } from '@expo/ui/swift-ui';
 * import { confirmationDialog } from '@expo/ui/swift-ui/modifiers';
 *
 * function MyComponent() {
 *   const [showDialog, setShowDialog] = useState(false);
 *
 *   return (
 *     <VStack modifiers={[
 *       confirmationDialog({
 *         title: "Delete item?",
 *         isPresented: showDialog,
 *         onDismiss: () => setShowDialog(false),
 *         actions: (
 *           <>
 *             <Button label="Delete" role="destructive" onPress={handleDelete} />
 *             <Button label="Cancel" role="cancel" />
 *           </>
 *         ),
 *         message: <Text>This action cannot be undone.</Text>,
 *       })
 *     ]}>
 *       <Button label="Delete" onPress={() => setShowDialog(true)} />
 *     </VStack>
 *   );
 * }
 * ```
 *
 * @platform ios 15.0+
 * @see Official [SwiftUI documentation](https://developer.apple.com/documentation/swiftui/view/confirmationdialog(_:ispresented:titlevisibility:actions:message:)).
 */
export declare function confirmationDialog(params: {
    /** The title of the confirmation dialog. */
    title: string;
    /** An optional message string. Ignored if `message` React element is provided. */
    messageText?: string;
    /** Whether the dialog is currently presented. */
    isPresented: boolean;
    /** Called when the dialog is dismissed (by tapping an action or the background). */
    onDismiss?: () => void;
    /** React elements to render as dialog action buttons. */
    actions?: React.ReactNode;
    /** A React element to render as the dialog message. */
    message?: React.ReactNode;
}): ModifierConfig;
//# sourceMappingURL=confirmationDialog.d.ts.map
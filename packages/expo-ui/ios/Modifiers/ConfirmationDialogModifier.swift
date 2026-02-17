// Copyright 2025-present 650 Industries. All rights reserved.

import ExpoModulesCore
import SwiftUI

/// Serializable config for the confirmationDialog modifier.
internal struct ConfirmationDialogRecord: Record {
  @Field var title: String = ""
  @Field var message: String?
  @Field var presented: Bool = false
}

/// A ViewModifier that presents a native SwiftUI confirmation dialog.
///
/// The dialog's action buttons and optional message view are provided via
/// `$slots` — injected automatically by `applyModifiers` from `ModifierSlotView` children.
internal struct ConfirmationDialogModifier: ViewModifier {
  let title: String
  let message: String?
  let presented: Bool
  let actionsChildren: [any ExpoSwiftUI.AnyChild]?
  let messageChildren: [any ExpoSwiftUI.AnyChild]?
  var eventDispatcher: EventDispatcher?

  func body(content: Content) -> some View {
    content.confirmationDialog(
      title,
      isPresented: Binding(
        get: { presented },
        set: { newValue in
          if presented != newValue {
            eventDispatcher?(["confirmationDialog": ["onDismiss": true]])
          }
        }
      ),
      titleVisibility: .visible
    ) {
      if let actionsChildren {
        ForEach(actionsChildren, id: \.id) { child in
          let view: any View = child.childView
          AnyView(view)
        }
      }
    } message: {
      if let messageChildren {
        ForEach(messageChildren, id: \.id) { child in
          let view: any View = child.childView
          AnyView(view)
        }
      } else if let message {
        Text(message)
      }
    }
  }
}

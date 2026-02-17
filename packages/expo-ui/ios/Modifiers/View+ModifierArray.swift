// Copyright 2015-present 650 Industries. All rights reserved.

import ExpoModulesCore
import SwiftUI

internal typealias ModifierType = [String: Any]
internal typealias ModifierArray = [ModifierType]

internal extension View {
  /**
   * Applies an array of modifiers to a view using the ViewModifierRegistry.
   *
   * When `children` is provided, any `ModifierSlotView` children are matched to modifiers
   * by type and their content is injected into the modifier's params dict under `$slots`.
   * This allows modifiers like `.confirmationDialog` and `.alert` to receive view children.
   */
  @ViewBuilder
  func applyModifiers(
    _ modifiers: ModifierArray?,
    children: [any ExpoSwiftUI.AnyChild]? = nil,
    appContext: AppContext?,
    globalEventDispatcher: EventDispatcher
  ) -> some View {
    if let modifiers, let appContext {
      modifiers.reduce(AnyView(self)) { currentView, modifierConfig in
        guard let type = modifierConfig["$type"] as? String else {
          return currentView
        }

        var params = modifierConfig

        // Inject matching ModifierSlot children into params
        if let children {
          let matchingSlots = children
            .compactMap { $0.childView as? ModifierSlotView }
            .filter { $0.props.modifierType == type }

          if !matchingSlots.isEmpty {
            var slotMap: [String: [any ExpoSwiftUI.AnyChild]] = [:]
            for slot in matchingSlots {
              if let slotChildren = slot.props.children {
                slotMap[slot.props.slotName] = slotChildren
              }
            }
            params["$slots"] = slotMap
          }
        }

        return ViewModifierRegistry.shared.applyModifier(
          type,
          to: currentView,
          appContext: appContext,
          globalEventDispatcher: globalEventDispatcher,
          params: params
        )
      }
    } else {
      self
    }
  }
}

internal extension Text {
  func applyTextModifiers(_ modifiers: ModifierArray?, appContext: AppContext?) -> Text {
    guard let modifiers, let appContext else { return self }

    return modifiers.reduce(self) { currentText, modifierConfig in
      guard let type = modifierConfig["$type"] as? String else {
        return currentText
      }

      return ViewModifierRegistry.shared.applyTextModifier(
        type,
        to: currentText,
        appContext: appContext,
        params: modifierConfig
      )
    }
  }
}

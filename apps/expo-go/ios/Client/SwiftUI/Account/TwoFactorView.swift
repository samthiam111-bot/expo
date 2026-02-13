//  Copyright © 2025 650 Industries. All rights reserved.

import SwiftUI

struct TwoFactorView: View {
  @ObservedObject var loginViewModel: LoginViewModel
  let onVerifySuccess: (String) async -> Void

  @FocusState private var isCodeFocused: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      if loginViewModel.isUsingRecoveryCode {
        recoveryCodeContent
      } else {
        otpContent
      }
    }
    .onAppear {
      isCodeFocused = true
    }
  }

  private var otpContent: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("Open your two-factor authentication app to view your one-time password.")
        .font(.system(size: 16))
        .foregroundColor(.secondary)

      VStack(alignment: .leading, spacing: 6) {
        Text("One-time password")
          .font(.callout)
          .fontWeight(.medium)

        otpInputField
      }

      if let error = loginViewModel.errorMessage {
        ErrorBanner(message: error)
      }

      verifyButton
      cancelButton

      (Text("Lost access to your 2FA device? ")
        .foregroundColor(.secondary)
      + Text("Enter a recovery code")
        .foregroundColor(.accentColor))
        .font(.callout)
        .onTapGesture {
          loginViewModel.isUsingRecoveryCode = true
          loginViewModel.otpCode = ""
          loginViewModel.errorMessage = nil
        }
    }
  }

  private var recoveryCodeContent: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("Enter one of your recovery codes to regain access to your account.")
        .font(.system(size: 16))
        .foregroundColor(.secondary)

      VStack(alignment: .leading, spacing: 6) {
        Text("Recovery code")
          .font(.callout)
          .fontWeight(.medium)

        TextField("", text: $loginViewModel.otpCode)
          .textInputAutocapitalization(.never)
          .disableAutocorrection(true)
          .focused($isCodeFocused)
          .padding()
          .background(Color.expoSecondarySystemBackground)
          .clipShape(RoundedRectangle(cornerRadius: BorderRadius.medium))
          .onSubmit {
            if loginViewModel.canSubmitOTP {
              Task {
                if let secret = await loginViewModel.submitOTP() {
                  await onVerifySuccess(secret)
                }
              }
            }
          }
          .submitLabel(.go)
      }

      if let error = loginViewModel.errorMessage {
        ErrorBanner(message: error)
      }

      verifyButton
      cancelButton

      Button {
        loginViewModel.isUsingRecoveryCode = false
        loginViewModel.otpCode = ""
        loginViewModel.errorMessage = nil
      } label: {
        Text("Use one-time password instead")
          .font(.callout)
          .foregroundColor(.accentColor)
      }
    }
  }

  private var otpInputField: some View {
    ZStack {
      TextField("", text: $loginViewModel.otpCode)
        .keyboardType(.numberPad)
        .textContentType(.oneTimeCode)
        .focused($isCodeFocused)
        .opacity(0.01)
        .frame(width: 1, height: 1)
        .onChange(of: loginViewModel.otpCode) { newValue in
          let filtered = String(newValue.filter { $0.isNumber }.prefix(6))
          if filtered != newValue {
            loginViewModel.otpCode = filtered
          }
          if filtered.count == 6 {
            Task {
              if let secret = await loginViewModel.submitOTP() {
                await onVerifySuccess(secret)
              }
            }
          }
        }

      HStack(spacing: 0) {
        digitGroup(startIndex: 0)

        Text("-")
          .font(.title2)
          .fontWeight(.medium)
          .foregroundColor(.secondary)
          .padding(.horizontal, 8)

        digitGroup(startIndex: 3)
      }
      .contentShape(Rectangle())
      .onTapGesture {
        isCodeFocused = true
      }
    }
  }

  private func digitGroup(startIndex: Int) -> some View {
    HStack(spacing: 6) {
      ForEach(startIndex..<startIndex + 3, id: \.self) { index in
        digitBox(at: index)
      }
    }
  }

  private func digitBox(at index: Int) -> some View {
    let chars = Array(loginViewModel.otpCode)
    let hasDigit = index < chars.count
    let isActive = index == chars.count && isCodeFocused

    return Text(hasDigit ? String(chars[index]) : "")
      .font(.title2)
      .fontWeight(.medium)
      .frame(maxWidth: .infinity)
      .frame(height: 48)
      .background(Color.expoSecondarySystemBackground)
      .clipShape(RoundedRectangle(cornerRadius: BorderRadius.medium))
      .overlay(
        RoundedRectangle(cornerRadius: BorderRadius.medium)
          .stroke(isActive ? Color.primary.opacity(0.5) : Color.clear, lineWidth: 1.5)
      )
  }

  private var verifyButton: some View {
    Button {
      UIImpactFeedbackGenerator(style: .light).impactOccurred()
      Task {
        if let secret = await loginViewModel.submitOTP() {
          await onVerifySuccess(secret)
        }
      }
    } label: {
      Text("Verify")
        .font(.headline)
        .fontWeight(.semibold)
        .foregroundColor(.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .overlay(alignment: .leading) {
          if loginViewModel.isLoading {
            ProgressView()
              .tint(.white)
              .scaleEffect(0.8)
              .padding(.leading, 16)
          }
        }
    }
    .background(!loginViewModel.canSubmitOTP || loginViewModel.isLoading ? Color.gray.opacity(0.3) : Color.black)
    .clipShape(RoundedRectangle(cornerRadius: BorderRadius.large))
    .disabled(!loginViewModel.canSubmitOTP || loginViewModel.isLoading)
  }

  private var cancelButton: some View {
    Button {
      loginViewModel.resetToCredentials()
    } label: {
      Text("Cancel")
        .font(.headline)
        .fontWeight(.semibold)
        .foregroundColor(.primary.opacity(0.7))
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
    }
    .background(Color.expoSecondarySystemBackground)
    .clipShape(RoundedRectangle(cornerRadius: BorderRadius.large))
  }
}

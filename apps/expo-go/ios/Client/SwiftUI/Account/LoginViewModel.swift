//  Copyright © 2025 650 Industries. All rights reserved.

import Foundation
import SwiftUI

@MainActor
class LoginViewModel: ObservableObject {
  enum Phase {
    case credentials
    case twoFactor
  }

  @Published var phase: Phase = .credentials
  @Published var username = ""
  @Published var password = ""
  @Published var otpCode = ""
  @Published var isLoading = false
  @Published var errorMessage: String?
  @Published var isUsingRecoveryCode = false

  private var secondFactorDevices: [SecondFactorDevice] = []
  private var savedPassword: String?

  var canSubmitLogin: Bool {
    !username.trimmingCharacters(in: .whitespaces).isEmpty &&
    !password.trimmingCharacters(in: .whitespaces).isEmpty
  }

  var canSubmitOTP: Bool {
    if isUsingRecoveryCode {
      return !otpCode.trimmingCharacters(in: .whitespaces).isEmpty
    }
    return otpCode.count == 6
  }

  func submitLogin() async -> String? {
    guard canSubmitLogin else { return nil }

    isLoading = true
    errorMessage = nil
    defer { isLoading = false }

    let request = LoginRequest(
      username: username.trimmingCharacters(in: .whitespaces),
      password: password,
      otp: nil
    )

    do {
      let response: LoginResponse = try await RESTClient.shared.post(
        path: "auth/loginAsync",
        body: request
      )
      return response.data.sessionSecret
    } catch let error as LoginError {
      return handleLoginError(error)
    } catch {
      errorMessage = error.localizedDescription
      return nil
    }
  }

  func submitOTP() async -> String? {
    guard canSubmitOTP else { return nil }

    isLoading = true
    errorMessage = nil
    defer { isLoading = false }

    let request = LoginRequest(
      username: username.trimmingCharacters(in: .whitespaces),
      password: savedPassword ?? password,
      otp: otpCode.trimmingCharacters(in: .whitespaces)
    )

    do {
      let response: LoginResponse = try await RESTClient.shared.post(
        path: "auth/loginAsync",
        body: request
      )
      return response.data.sessionSecret
    } catch let error as LoginError {
      switch error {
      case .invalidCredentials(let message), .apiError(let message):
        errorMessage = message
      case .networkError(let error):
        errorMessage = "Network error: \(error.localizedDescription)"
      case .otpRequired:
        errorMessage = "Invalid code. Please try again."
      }
      return nil
    } catch {
      errorMessage = error.localizedDescription
      return nil
    }
  }

  func sendSMSOTP(to device: SecondFactorDevice) async {
    let request = SendSMSOTPRequest(
      username: username.trimmingCharacters(in: .whitespaces),
      password: savedPassword ?? password,
      secondFactorDeviceID: device.id
    )

    do {
      let _: LoginResponse = try await RESTClient.shared.post(
        path: "auth/send-sms-otp",
        body: request
      )
    } catch {
      // SMS send is best-effort
    }
  }

  func resetToCredentials() {
    withAnimation {
      phase = .credentials
    }
    otpCode = ""
    errorMessage = nil
    isUsingRecoveryCode = false
    secondFactorDevices = []
    savedPassword = nil
  }

  private func handleLoginError(_ error: LoginError) -> String? {
    switch error {
    case .otpRequired(let devices, _):
      secondFactorDevices = devices
      savedPassword = password
      password = ""
      withAnimation {
        phase = .twoFactor
      }
      errorMessage = nil
      return nil
    case .invalidCredentials(let message):
      errorMessage = message
      return nil
    case .apiError(let message):
      errorMessage = message
      return nil
    case .networkError(let error):
      errorMessage = "Network error: \(error.localizedDescription)"
      return nil
    }
  }
}

package expo.modules.ui

import android.annotation.SuppressLint
import android.content.Context
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ComposableScope
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.ExpoComposeView

internal data class RNHostProps(
  val matchContents: MutableState<Boolean?> = mutableStateOf(null)
) : ComposeProps

@SuppressLint("ViewConstructor")
internal class RNHostView(context: Context, appContext: AppContext) :
  ExpoComposeView<RNHostProps>(context, appContext) {
  override val props = RNHostProps()

  @Composable
  override fun ComposableScope.Content() {
    val matchContents = props.matchContents.value ?: false
    val density = LocalDensity.current

    val sizeModifier = Modifier.onSizeChanged { size ->
      with(density) {
        shadowNodeProxy.setViewSize(
          size.width.toDp().value.toDouble(),
          size.height.toDp().value.toDouble()
        )
      }
    }

    Box(
      modifier = if (matchContents) sizeModifier else Modifier.fillMaxSize().then(sizeModifier)
    ) {
      Children(this@Content)
    }
  }
}

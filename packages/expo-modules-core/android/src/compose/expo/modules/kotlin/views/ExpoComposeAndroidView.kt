package expo.modules.kotlin.views

import android.annotation.SuppressLint
import android.view.View
import android.view.ViewGroup
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.facebook.react.uimanager.PixelUtil.pxToDp
import expo.modules.kotlin.AppContext

/**
 * Marks a view as capable of crossing the Jetpack Compose -> React Native boundary.
 */
interface RNHostViewInterface {
  var matchContents: Boolean
}

/**
 * An ExpoComposeView for [AndroidView] wrapping with existing view
 */
@SuppressLint("ViewConstructor")
internal class ExpoComposeAndroidView(
  private val view: View,
  appContext: AppContext
) : ExpoComposeView<ComposeProps>(view.context, appContext), RNHostViewInterface {
  override var matchContents = false

  @Composable
  override fun ComposableScope.Content() {
    val w = view.width.toFloat().pxToDp()
    val h = view.height.toFloat().pxToDp()
    AndroidView(
      factory = {
        // Detach from any existing parent (e.g. a previous AndroidViewHolder)
        // to avoid "The specified child already has a parent" when the
        // composition is recreated by a parent SubcomposeLayout.
        (view.parent as? ViewGroup)?.removeView(view)
        view
      },
      modifier = Modifier.size(w.dp, h.dp)
    )
  }
}

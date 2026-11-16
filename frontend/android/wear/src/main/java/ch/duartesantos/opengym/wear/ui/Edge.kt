package ch.duartesantos.opengym.wear.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.wear.compose.foundation.lazy.TransformingLazyColumnItemScope
import androidx.wear.compose.foundation.lazy.TransformingLazyColumnScope
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material3.lazy.TransformationSpec
import androidx.wear.compose.material3.lazy.transformedHeight

/*
 * A row of a TransformingLazyColumn that shrinks and fades as it nears the top or bottom edge, as
 * Wear OS lists do. Without it a full-width button kept its full width right up to the bezel, and a
 * round screen (Galaxy Watch Ultra, 480 px) cut its corners and the first line of text.
 * One `spec` per list: val edge = rememberTransformationSpec().
 */

@Composable
fun TransformingLazyColumnItemScope.EdgeBox(spec: TransformationSpec, content: @Composable () -> Unit) {
    Box(
        Modifier.transformedHeight(this, spec).graphicsLayer { with(spec) { applyContainerTransformation(scrollProgress) } },
        contentAlignment = Alignment.Center,
    ) { content() }
}

fun TransformingLazyColumnScope.edgeItem(spec: TransformationSpec, content: @Composable () -> Unit) =
    item { EdgeBox(spec) { content() } }

fun <T> TransformingLazyColumnScope.edgeItems(list: List<T>, spec: TransformationSpec, content: @Composable (T) -> Unit) =
    items(list) { EdgeBox(spec) { content(it) } }

package dev.squad52.android_edutech.ui.components

import android.graphics.Color as AndroidColor
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import dev.squad52.android_edutech.ui.theme.LocalAppColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun MathText(
    text: String,
    modifier: Modifier = Modifier,
    fontSize: Int = 16,
    color: Color? = null
) {
    val colors = LocalAppColors.current
    val fgColor = color ?: colors.foreground
    val hasMath = text.contains("\\(") || text.contains("\\[")

    if (!hasMath) {
        Text(
            text = text,
            modifier = modifier,
            fontSize = fontSize.sp,
            color = fgColor,
            lineHeight = (fontSize * 1.5f).sp
        )
        return
    }

    val colorHex = "#%06X".format(fgColor.toArgb() and 0xFFFFFF)

    key(text, colorHex) {
        var webHeight by remember { mutableStateOf(80.dp) }
        val scope = rememberCoroutineScope()

        AndroidView(
            factory = { ctx ->
                WebView(ctx).apply {
                    settings.javaScriptEnabled = true
                    @Suppress("DEPRECATION")
                    settings.allowUniversalAccessFromFileURLs = true
                    settings.allowFileAccess = true
                    setBackgroundColor(AndroidColor.TRANSPARENT)
                    isScrollContainer = false

                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView, url: String) {
                            scope.launch {
                                delay(150)
                                view.evaluateJavascript("document.body.scrollHeight") { h ->
                                    h?.trim('"')?.toDoubleOrNull()?.let { px ->
                                        webHeight = (px + 8).dp
                                    }
                                }
                                delay(750)
                                view.evaluateJavascript("document.body.scrollHeight") { h ->
                                    h?.trim('"')?.toDoubleOrNull()?.let { px ->
                                        webHeight = (px + 8).dp
                                    }
                                }
                            }
                        }
                    }

                    loadDataWithBaseURL(
                        "file:///android_asset/katex/",
                        buildMathHtml(text, colorHex, fontSize),
                        "text/html",
                        "UTF-8",
                        null
                    )
                }
            },
            modifier = modifier.fillMaxWidth().height(webHeight)
        )
    }
}

private fun buildMathHtml(text: String, colorHex: String, fontSize: Int): String {
    val escaped = text
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    return """<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="katex.min.css">
<script defer src="katex.min.js"></script>
<script defer src="auto-render.min.js"
    onload="renderMathInElement(document.body,{delimiters:[{left:'\\(',right:'\\)',display:false},{left:'\\[',right:'\\]',display:true}],throwOnError:false});">
</script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; max-width: 100%; overflow-x: hidden; }
body { font-family: sans-serif; font-size: ${fontSize}px; color: $colorHex; line-height: 1.5; background: transparent; padding: 2px 0; word-break: break-word; }
.katex { font-size: 1em; }
.katex-display { overflow-x: auto; overflow-y: hidden; }
img, svg { max-width: 100%; height: auto; }
</style>
</head>
<body>$escaped</body>
</html>"""
}

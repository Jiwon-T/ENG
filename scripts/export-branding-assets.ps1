# Export the approved design only; no redraw or colour changes.
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskPublic=Join-Path $taskRoot 'public'
$taskSource=[System.Drawing.Bitmap]::new((Join-Path $taskPublic 'branding/pen-nib-approved.png'))
try {
 # Ignore almost-transparent fringe when locating the tile, retaining its rounded silhouette.
 $left=$taskSource.Width;$top=$taskSource.Height;$right=0;$bottom=0
 for($y=0;$y -lt $taskSource.Height;$y++){for($x=0;$x -lt $taskSource.Width;$x++){if($taskSource.GetPixel($x,$y).A -ge 128){$left=[Math]::Min($left,$x);$top=[Math]::Min($top,$y);$right=[Math]::Max($right,$x);$bottom=[Math]::Max($bottom,$y)}}}
 $taskRect=[System.Drawing.Rectangle]::new($left,$top,$right-$left+1,$bottom-$top+1)
 # Home-screen icons are cropped by the OS, so they fill the whole canvas with the tile purple: iOS shows
 # transparent pixels as black and Android launchers may show the maskable icon's corners.
 $brandPurple=[System.Drawing.Color]::FromArgb(255,84,44,250)
 function Export-Png([string]$name,[int]$width,[int]$height,[int]$logoSize,[bool]$opaque,[bool]$brandFill=$false){
  $bitmap=[System.Drawing.Bitmap]::new($width,$height,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
  $attr=[System.Drawing.Imaging.ImageAttributes]::new()
  try{
   $graphics.Clear($(if($brandFill){$brandPurple}elseif($opaque){[System.Drawing.Color]::White}else{[System.Drawing.Color]::Transparent}))
   $graphics.CompositingQuality=[System.Drawing.Drawing2D.CompositingQuality]::HighQuality
   $graphics.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
   $graphics.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
   $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
   $dest=[System.Drawing.Rectangle]::new([int](($width-$logoSize)/2),[int](($height-$logoSize)/2),$logoSize,$logoSize)
   $graphics.DrawImage($taskSource,$dest,$taskRect.X,$taskRect.Y,$taskRect.Width,$taskRect.Height,[System.Drawing.GraphicsUnit]::Pixel,$attr)
   $path=Join-Path $taskPublic $name
   [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($path)) | Out-Null
   $bitmap.Save($path,[System.Drawing.Imaging.ImageFormat]::Png)
  }finally{$attr.Dispose();$graphics.Dispose();$bitmap.Dispose()}
 }
 foreach($size in @(16,32,48,96)){Export-Png "favicon-$($size)x$($size).png" $size $size $size $false}
 foreach($size in @(36,48,72,96,144,192,512)){Export-Png "android-icon-$($size)x$($size).png" $size $size $size $false}
 foreach($size in @(57,60,72,76,114,120,144,152,180)){Export-Png "apple-icon-$($size)x$($size).png" $size $size $size $true $true}
 foreach($size in @(70,144,150,310)){Export-Png "ms-icon-$($size)x$($size).png" $size $size $size $true}
 Export-Png 'icon.png' 512 512 512 $false
 # Maskable keeps the pen nib inside Android's safe area; ordinary favicon retains the approved rounded-square.
 Export-Png 'android-icon-maskable-512x512.png' 512 512 400 $true $true
 $html=[System.IO.File]::ReadAllText((Join-Path $taskRoot 'index.html'))
 $tags=[regex]::Matches($html,'<link\s+rel="apple-touch-startup-image"[^>]+>')
 foreach($tag in $tags){
  $text=$tag.Value;$width=[int][regex]::Match($text,'device-width: (\d+)px').Groups[1].Value
  $height=[int][regex]::Match($text,'device-height: (\d+)px').Groups[1].Value
  $ratio=[int][regex]::Match($text,'device-pixel-ratio: (\d+)').Groups[1].Value
  $name=[regex]::Match($text,'href="([^"?]+)').Groups[1].Value.TrimStart('/')
  $width*=$ratio;$height*=$ratio
  if($text.Contains('orientation: landscape')){$swap=$width;$width=$height;$height=$swap}
  Export-Png $name $width $height (128*$ratio) $true
 }
 # Multi-resolution ICO container with PNG entries; standard Windows/browser format.
 $sizes=@(16,32,48);$entries=@();foreach($size in $sizes){$entries+=,[System.IO.File]::ReadAllBytes((Join-Path $taskPublic "favicon-$($size)x$($size).png"))}
 $stream=[System.IO.MemoryStream]::new();$writer=[System.IO.BinaryWriter]::new($stream)
 try{$writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]$sizes.Count);$offset=6+16*$sizes.Count
  for($i=0;$i -lt $sizes.Count;$i++){$writer.Write([byte]$sizes[$i]);$writer.Write([byte]$sizes[$i]);$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([uint16]1);$writer.Write([uint16]32);$writer.Write([uint32]$entries[$i].Length);$writer.Write([uint32]$offset);$offset+=$entries[$i].Length}
  foreach($entry in $entries){$writer.Write([byte[]]$entry)}
  [System.IO.File]::WriteAllBytes((Join-Path $taskPublic 'favicon.ico'),$stream.ToArray())
 }finally{$writer.Dispose();$stream.Dispose()}
 # Keep legacy project-root assets and deployable public assets identical.
 foreach($name in @('apple-icon.png','apple-icon-precomposed.png')){Copy-Item -LiteralPath (Join-Path $taskPublic 'apple-icon-180x180.png') -Destination (Join-Path $taskPublic $name)}
 [System.IO.Directory]::CreateDirectory((Join-Path $taskPublic 'icons')) | Out-Null
 [System.IO.Directory]::CreateDirectory((Join-Path $taskRoot 'icons')) | Out-Null
 foreach($size in @(192,512)){
  Copy-Item -LiteralPath (Join-Path $taskPublic "android-icon-$($size)x$($size).png") -Destination (Join-Path $taskPublic "icons/icon-$size.png")
  Copy-Item -LiteralPath (Join-Path $taskPublic "icons/icon-$size.png") -Destination (Join-Path $taskRoot "icons/icon-$size.png")
 }
 foreach($file in Get-ChildItem -LiteralPath $taskPublic -File | Where-Object {$_.Name -match '^(?:favicon|android-icon|apple-icon|ms-icon|icon).*(?:\.png|\.ico)$'}){
  Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $taskRoot $file.Name)
 }
 [System.IO.Directory]::CreateDirectory((Join-Path $taskRoot 'splash_screens')) | Out-Null
 foreach($file in Get-ChildItem -LiteralPath (Join-Path $taskPublic 'splash_screens') -File){Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $taskRoot ('splash_screens/'+$file.Name))}
 if(Test-Path -LiteralPath (Join-Path $taskRoot 'browserconfig.xml')){Copy-Item -LiteralPath (Join-Path $taskRoot 'browserconfig.xml') -Destination (Join-Path $taskPublic 'browserconfig.xml')}
 Write-Output ('SPLASH_FILES='+$tags.Count)
 Write-Output ('MASTER_CROP='+$taskRect.Width+'x'+$taskRect.Height)
}finally{$taskSource.Dispose()}


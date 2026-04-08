<script setup>
import { computed } from 'vue'

// Define component props
const props = defineProps({
  // Icon name (matches the SVG filename without extension)
  name: {
    type: String,
    required: true,
    validator: (value) => typeof value === 'string' && value.length > 0
  },
  // Icon size in pixels or CSS units
  size: {
    type: [String, Number],
    default: 24,
    validator: (value) => {
      if (typeof value === 'number') return value > 0
      if (typeof value === 'string') return /^\d+(\.\d+)?(px|rem|em|%)?$/.test(value)
      return false
    }
  },
  // Icon color (CSS color value)
  color: {
    type: String,
    default: 'currentColor'
  },
  className: {
    type: [String, Array, Object],
    default: ''
  },
  // Accessibility label
  ariaLabel: {
    type: String,
    default: ''
  },
  // Whether the icon is decorative only
  decorative: {
    type: Boolean,
    default: false
  }
})

// Import all SVG files from assets directory (Nuxt app/assets/)
const svgModules = import.meta.glob('../assets/**/*.svg', {
  as: 'raw',
  eager: true
})

// Create a map of icon names to their SVG content
// Keys: root-level → 'icon', subfolder → 'subfolder/icon' (e.g. 'avatar/user')
const iconMap = computed(() => {
  const icons = {}

  for (const path in svgModules) {
    const pathSegments = path.split('/')
    const filename = pathSegments.pop().replace('.svg', '')
    const parent   = pathSegments[pathSegments.length - 1]

    if (parent === 'assets') {
      // Root level: ../assets/icon.svg → 'icon'
      icons[filename] = svgModules[path]
    } else {
      // Subfolder: ../assets/avatar/beard.svg → 'avatar/beard'
      icons[`${parent}/${filename}`] = svgModules[path]
    }
  }

  return icons
})

// Get the SVG content for the requested icon
const svgContent = computed(() => {
  const content = iconMap.value[props.name]

  if (!content) {
    console.warn(`Icon "${props.name}" not found. Available icons:`, Object.keys(iconMap.value))
    return null
  }

  return content
})

// Compute the size with units
const iconSize = computed(() => {
  if (typeof props.size === 'number') {
    return `${props.size}px`
  }
  return props.size
})

// Compute accessibility attributes
const accessibilityAttrs = computed(() => {
  if (props.decorative) {
    return {
      'aria-hidden': 'true',
      role: 'presentation'
    }
  }

  return {
    'aria-label': props.ariaLabel || `${props.name} icon`,
    role: 'img'
  }
})

// Parse and modify SVG content to apply props
const processedSvgContent = computed(() => {
  if (!svgContent.value) return ''

  let processed = svgContent.value

  // Remove existing width, height, and style attributes from SVG tag
  processed = processed.replace(/<svg[^>]*>/, (match) => {
    return match
      .replace(/\s*width="[^"]*"/g, '')
      .replace(/\s*height="[^"]*"/g, '')
      .replace(/\s*style="[^"]*"/g, '')
  })

  // Add our custom attributes
  processed = processed.replace('<svg', `<svg
    width="${iconSize.value}"
    height="${iconSize.value}"
    style="color: ${props.color}; display: inline-block; vertical-align: middle;"`)

  return processed
})
</script>

<template>
  <span
    v-if="svgContent"
    class="icon-wrapper"
    :class="className"
    v-bind="accessibilityAttrs"
    v-html="processedSvgContent"
  />
  <span
    v-else
    class="icon-wrapper icon-missing"
    :class="className"
    :style="{
      width: iconSize,
      height: iconSize,
      backgroundColor: '#ff0000',
      display: 'inline-block'
    }"
    :title="`Missing icon: ${name}`"
  >
    ?
  </span>
</template>

<style scoped>
.icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.icon-wrapper :deep(svg) {
  display: block;
  fill: currentColor;
  stroke: currentColor;
}
.icon-wrapper :deep(svg[fill="none"]) {
  fill: none;
}
.icon-wrapper :deep(svg path[fill="currentColor"]),
.icon-wrapper :deep(svg circle[fill="currentColor"]),
.icon-wrapper :deep(svg rect[fill="currentColor"]) {
  fill: currentColor;
}
.icon-wrapper :deep(svg path[stroke="currentColor"]),
.icon-wrapper :deep(svg circle[stroke="currentColor"]),
.icon-wrapper :deep(svg line[stroke="currentColor"]) {
  stroke: currentColor;
}
.icon-missing {
  background-color: red;
  color: white;
  border-radius: 2px;
  font-size: 12px;
  font-weight: bold;
}
</style>
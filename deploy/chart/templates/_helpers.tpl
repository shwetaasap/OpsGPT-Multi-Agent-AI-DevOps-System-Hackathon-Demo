{{/* vim: set filetype=mustache: */}}

{{- define "c6-hackathon.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "c6-hackathon.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "c6-hackathon.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "c6-hackathon.labels" -}}
app.kubernetes.io/name: {{ include "c6-hackathon.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: {{ .Values.labels.partOf | default "c6-hackathon" }}
app.kubernetes.io/component: {{ .Values.labels.component | default "api" }}
helm.sh/chart: {{ include "c6-hackathon.chart" . }}
app: {{ include "c6-hackathon.name" . }}
team: {{ .Values.labels.team | default "hackathon" }}
env: {{ .Values.labels.env | default "production" }}
{{- end -}}

{{- define "c6-hackathon.selectorLabels" -}}
app.kubernetes.io/name: {{ include "c6-hackathon.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "c6-hackathon.serviceAccountName" -}}
{{- include "c6-hackathon.fullname" . -}}
{{- end -}}

require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'BuildalphaCapacitorVoice'
  s.version = package['version']
  s.summary = package['description']
  s.license = package['license']
  s.homepage = 'https://github.com/buildalpha98-del/SOLVR'
  s.author = package['author']
  s.source = { :git => 'https://github.com/buildalpha98-del/SOLVR.git', :tag => s.version.to_s }
  s.source_files = 'ios/Plugin/**/*.{swift,h,m}'
  s.exclude_files = 'ios/Plugin/Tests/**/*'
  s.ios.deployment_target = '14.0'
  s.dependency 'Capacitor'
  s.dependency 'TwilioVoice', '~> 6.12'
  s.swift_version = '5.0'
end
